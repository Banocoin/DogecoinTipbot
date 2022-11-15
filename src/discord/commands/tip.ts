import { Message } from "discord.js";
import { allowedCoins, defaultEmoji, disabledTokens, tokenDecimals, tokenIds, tokenNames, tokenTickers } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import { isDiscordUserArgument, parseDiscordUser, throwFrozenAccountError } from "../util";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import TipStats from "../../models/TipStats";
import { requestWallet } from "../../libwallet/http";
import { whitelistedBots } from "../constants";
import { publicBot, sentHashes } from "..";
import { parseAmount } from "../../common/amounts";
import { SendTransaction } from "../../wallet/events";
import TipWebhook from "../../models/TipWebhook";
import { tokenPrices } from "../../common/price";
import * as tweetnacl from "tweetnacl"
import fetch from "node-fetch";

export default new class TipCommand implements Command {
    description = "Tip someone on Discord"
    extended_description = `Tip someone over Discord. 
If they don't have an account on the tipbot, it will create one for them.

Examples:
**Give one ${tokenNameToDisplayName("VITC")} to a single person**
.v 1 <@696481194443014174>
**Give one ${tokenNameToDisplayName("BAN")} to a single person**
.tip 1 ban <@696481194443014174>
**Give one ${tokenNameToDisplayName("VITC")} to more than one person**
.vitc 1 <@112006418676113408> <@862414189464256542>`

    alias = ["tip", "vitc", "v"]
    usage = "<amount> {currency} <...@someone>"

    async execute(message:Message, args: string[], command: string){
        let [
            // eslint-disable-next-line prefer-const
            amount,
            currencyOrRecipient,
            // eslint-disable-next-line prefer-const
            ...recipientsRaw
        ] = args
        currencyOrRecipient = currencyOrRecipient || "vitc"
        if(!amount)return help.execute(message, [command])
        if(isDiscordUserArgument(currencyOrRecipient)){
            if(command === "tip"){
                return message.reply(`Looks like you tried to use the \`${process.env.DISCORD_PREFIX}tip\` command without a currency. Please note that this syntax is now *deprecated*. Please always specify the currency using the tip command.`)
            }
            // user here
            recipientsRaw.push(currencyOrRecipient)
            currencyOrRecipient = "vitc"
        }
        currencyOrRecipient = currencyOrRecipient.toUpperCase()
        if(message.mentions.repliedUser){
            recipientsRaw.push(message.mentions.repliedUser.id)
        }
        if(command !== "tip" && currencyOrRecipient !== "VITC"){
            if(message.mentions.repliedUser){
                currencyOrRecipient = "VITC"
            }else{
                message.reply(`Looks like you tried to use another currency than vitc. Please use the .tip command for this.`)
                return
            }
        }

        if(!(currencyOrRecipient in tokenIds)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`The token **${currencyOrRecipient}** isn't supported.`)
            return
        }
        if((tokenIds[currencyOrRecipient] in disabledTokens)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`The token **${currencyOrRecipient}** is currently disabled because: ${disabledTokens[tokenIds[currencyOrRecipient]]}`)
            return
        }
        if(!(allowedCoins[message.guildId] || [tokenIds[currencyOrRecipient]]).includes(tokenIds[currencyOrRecipient])){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(
                `You can't use **${tokenNameToDisplayName(currencyOrRecipient)}** (${currencyOrRecipient}) in this server.`
            )
            return
        }
        if(recipientsRaw.length === 0)return help.execute(message, [command])

        const amountParsed = parseAmount(amount, tokenIds[currencyOrRecipient])
        if(amountParsed.isEqualTo(0)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(
                `You can't send a tip of **0 ${tokenNameToDisplayName(currencyOrRecipient)}**.`
            )
            return
        }
        
        const recipients = []
        const promises = []
        for(const recipient of recipientsRaw){
            promises.push((async () => {
                try{
                    const users = await parseDiscordUser(recipient)
                    for(const user of users){
                        // couldn't find it
                        if(!user)continue
                        // bot
                        if(user.bot){
                            if(!whitelistedBots.includes(user.id))continue
                        }
                        // same person sending to itself
                        if(user.id === message.author.id)continue
                        // User already resolved, double pinging.
                        if(recipients.find(e => e.id === user.id))continue
                        recipients.push(user)
                    }
                }catch{}
            })())
        }
        await Promise.all(promises)
        if(recipients.length === 0){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`Couldn't parse any recipient in your message.`)
            return
        }
        const totalAsked = amountParsed.times(recipients.length)

        const [
            address,
            addresses
        ] = await Promise.all([
            discordqueue.queueAction(message.author.id, async () => {
                return getVITEAddressOrCreateOne(message.author.id, "Discord")
            }),
            Promise.all(recipients.map(async (recipient) => {
                return discordqueue.queueAction(recipient.id, async () => {
                    return getVITEAddressOrCreateOne(recipient.id, "Discord")
                })
            }))
        ])

        if(address.paused){
            await throwFrozenAccountError(message, args, command)
        }

        await viteQueue.queueAction(address.address, async () => {
            try{
                await message.react(defaultEmoji)
            }catch{}
            const balances = await requestWallet("get_balances", address.address)
            const token = tokenIds[currencyOrRecipient]
            const balance = new BigNumber(token ? balances[token] || "0" : "0")
            const totalAskedRaw = new BigNumber(convert(totalAsked, currencyOrRecipient, "RAW"))
            if(balance.isLessThan(totalAskedRaw)){
                try{
                    await message.react("❌")
                }catch{}
                await message.reply(
                    `You don't have enough money to cover this tip. You need ${totalAsked.toFixed()} ${currencyOrRecipient} but you only have ${convert(balance, "RAW", currencyOrRecipient)} ${currencyOrRecipient} in your balance. Use .deposit to top up your account.`
                )
                return
            }
            if(addresses.length > 1){
                const amount = convert(amountParsed, currencyOrRecipient, "RAW")
                let txs:SendTransaction[] = []
                const chunk = 400
                for(let i = 0; i*chunk < addresses.length; i++){
                    const tx = await requestWallet(
                        "bulk_send",
                        address.address, 
                        addresses
                        .slice(i*chunk, i*chunk+chunk)
                        .map(e => [
                            e.address,
                            amount
                        ]), 
                        token,
                        addresses.length > i*chunk+chunk ? 75000 : 0
                    )
                    txs = txs.concat(tx[1])
                }
                if(publicBot === message.client.user.id){
                    for(const tx of txs){
                        sentHashes.add(tx.hash)
                        setTimeout(() => {
                            sentHashes.delete(tx.hash)
                        }, 60000)
                    }
                }
                await TipStats.create({
                    amount: parseFloat(
                        convert(
                            totalAskedRaw, 
                            "RAW", 
                            "VITC"
                        )
                    ),
                    user_id: message.author.id,
                    tokenId: token,
                    txhash: Buffer.from(txs[0].hash, "hex")
                })
            }else{
                const amount = convert(amountParsed, currencyOrRecipient, "RAW")
                const tx = await requestWallet(
                    "send",
                    address.address, 
                    addresses[0].address, 
                    amount, 
                    token
                )
                if(publicBot === message.client.user.id){
                    sentHashes.add(tx.hash)
                    setTimeout(() => {
                        sentHashes.delete(tx.hash)
                    }, 60000)
                }
                await TipStats.create({
                    amount: parseFloat(
                        convert(
                            amount, 
                            "RAW", 
                            "VITC"
                        )
                    ),
                    user_id: message.author.id,
                    tokenId: token,
                    txhash: Buffer.from(tx.hash, "hex")
                })
            }
            try{
                await message.react("909408282307866654")
            }catch{}
            if(recipients.find(e => e.bot)){
                const webhooks = await TipWebhook.find({
                    $or: recipients.map(e => (e.bot && {
                        bot_id: e.id
                    })).filter(e => !!e)
                })
                const promises = []
                for(const webhook of webhooks){
                    let body = null
                    switch(webhook.version){
                        case 0: {
                            body = {
                                type: "tip",
                                from: message.author.id,
                                to: webhook.bot_id,
                                message: message.id,
                                channel: message.channel.id,
                                guild: message.guild?.id,
                                raw_amount: convert(amountParsed, currencyOrRecipient, "RAW"),
                                amount: convert(convert(amountParsed, currencyOrRecipient, "RAW"), "RAW", tokenTickers[token]),
                                token: {
                                    id: token,
                                    ticker: tokenTickers[token],
                                    decimals: tokenDecimals[tokenTickers[token]],
                                    name: tokenNames[tokenTickers[token]],
                                    prices: {
                                        usd: tokenPrices[token+"/"+tokenIds.USDT]?.closePrice,
                                        vite: tokenPrices[token+"/"+tokenIds.VITE]?.closePrice,
                                        btc: tokenPrices[token+"/"+tokenIds.BTC]?.closePrice,
                                        eth: tokenPrices[token+"/"+tokenIds.ETH]?.closePrice,
                                    }
                                },
                                recipients: recipients.map(e => e.id)
                            }
                        }
                    }
                    if(!body)continue
                    const str = JSON.stringify(body)
                    // VitaBot Public key: 909ddbfd12d5ad92fd213b769753a4b99778b2d36e0a0b5699b72041465299f2
                    const signature = tweetnacl.sign.detached(
                        Buffer.from(str, "utf8"),
                        Buffer.from(
                            process.env.SIGNATURE_KEY,
                            "hex"
                        )
                    )
                    promises.push(fetch(webhook.webhook_url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "body-signature": Buffer.from(signature).toString("hex"),
                            "public-key": Buffer.from(
                                tweetnacl.sign.keyPair.fromSecretKey(
                                    Buffer.from(
                                        process.env.SIGNATURE_KEY,
                                        "hex"
                                    )
                                ).publicKey
                            ).toString("hex")
                        },
                        body: Buffer.from(str, "utf8")
                    }).catch(console.error))
                }

                Promise.all(promises)
            }
        })
    }
}