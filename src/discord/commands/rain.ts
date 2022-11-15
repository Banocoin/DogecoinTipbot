import { Message } from "discord.js";
import { allowedCoins, defaultEmoji, disabledTokens, RAIN_MIN, RAIN_MIN_WHITELISTED, tokenDecimals, tokenIds, tokenTickers, VITABOT_GITHUB } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import { throwFrozenAccountError } from "../util";
import TipStats from "../../models/TipStats";
import { getActiveUsers } from "../ActiviaManager";
import { BulkSendResponse, requestWallet } from "../../libwallet/http";
import { parseAmount } from "../../common/amounts";
import { BOT_OWNER } from "../constants";
import { tokenPrices } from "../../common/price";

export default new class RainCommand implements Command {
    description = "Tip active users"
    extended_description = `Tip active users. 
If they don't have an account on the tipbot, it will create one for them.
**The minimum amount to rain is 100 ${tokenNameToDisplayName("VITC")}**

Examples:
**Rain 1000 ${tokenNameToDisplayName("VITC")} !**
.rain 1000
**Rain 10 ${tokenNameToDisplayName("VITE")} !**
.rain 10 vite`

    alias = ["vrain", "rain", "vitaminrain", "snow"]
    usage = "<amount> {currency}"

    async execute(message:Message, args: string[], command: string){
        if(!message.guild){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        const amountRaw = args[0]
        if(!amountRaw){
            await help.execute(message, [command])
            return
        }
        const currency = (args[1] || "vitc").toUpperCase()
        if(!(currency in tokenIds)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`The token **${currency}** isn't supported.`)
            return
        }
        if((tokenIds[currency] in disabledTokens)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`The token **${currency}** is currently disabled, because: ${disabledTokens[tokenIds[currency]]}`)
            return
        }
        if(!(allowedCoins[message.guildId] || [tokenIds[currency]]).includes(tokenIds[currency])){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(
                `You can't use **${tokenNameToDisplayName(currency)}** (${currency}) in this server.`
            )
            return
        }
        const token = tokenIds[currency]
        const amount = parseAmount(amountRaw, token)
        const rainMinStr = RAIN_MIN_WHITELISTED[token] || RAIN_MIN
        let rainMin:BigNumber
        try{
            rainMin = parseAmount(rainMinStr, token)
        }catch{
            // No price for token ? kek just discard
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`This token can't be rained because it doesn't have a price yet. To whitelist it, please contact <@${BOT_OWNER}> or open an issue on ${VITABOT_GITHUB}.`)
            return
        }
        if(amount.isLessThan(rainMin)){
            await message.reply(`The minimum amount to rain is **${rainMinStr} ${tokenNameToDisplayName(token)}**.`)
            return
        }
        const userList = (await getActiveUsers(message.guildId, token === tokenIds.VITC))
            .filter(e => e !== message.author.id)
        if(userList.length < 5){
            await message.reply(`There are less than **5 active users** (${userList.length} active users). Cannot rain.`)
            return
        }
        const individualAmount = new BigNumber(
            amount.div(userList.length)
            .shiftedBy(tokenDecimals[currency]).toFixed(0)
        ).shiftedBy(-tokenDecimals[currency])
        const totalAsked = individualAmount.times(userList.length)
        const [
            address,
            addresses
        ] = await Promise.all([
            discordqueue.queueAction(message.author.id, async () => {
                return getVITEAddressOrCreateOne(message.author.id, "Discord")
            }),
            Promise.all(userList.map(id => {
                return discordqueue.queueAction(id, async () => {
                    return getVITEAddressOrCreateOne(id, "Discord")
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
            const balance = new BigNumber(balances[token] || 0)
            const totalAskedRaw = new BigNumber(convert(totalAsked, currency, "RAW"))
            if(balance.isLessThan(totalAskedRaw)){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send(
                    `You don't have enough money to cover this rain. You need **${totalAsked.toFixed()} ${tokenNameToDisplayName(currency)}** but you only have **${convert(balance, "RAW", tokenTickers[token])} ${tokenNameToDisplayName(token)}** in your balance. Use .deposit to top up your account.`
                )
                return
            }
            const rawIndividualAmount = convert(individualAmount, currency, "RAW")
            const txs:BulkSendResponse = await requestWallet(
                "bulk_send",
                address.address, 
                addresses.map(e => [
                    e.address,
                    rawIndividualAmount
                ]),
                token
            )
            await TipStats.create({
                amount: parseFloat(
                    convert(totalAskedRaw, "RAW", tokenTickers[token])
                ),
                user_id: message.author.id,
                tokenId: token,
                txhash: Buffer.from(txs[0][0].hash, "hex")
            })
            try{
                await message.react("909408282307866654")
            }catch{}
            const pair = tokenPrices[token+"/"+tokenIds.USDT]
            try{
                await message.reply(`Distributed **${convert(totalAskedRaw, "RAW", tokenTickers[token])} ${tokenNameToDisplayName(token)}** (= **$${
                    new BigNumber(pair?.closePrice || 0)
                    .times(totalAsked)
                    .decimalPlaces(2).toFixed(2)
                }**) amongst **${userList.length} active members**!`)
            }catch{}
        })
    }
}
