import { Message } from "discord.js";
import { allowedCoins, defaultEmoji, disabledTokens, tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import { throwFrozenAccountError } from "../util";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import { parseAmount } from "../../common/amounts";
import { tokenPrices } from "../../common/price";
import BurnStats from "../../models/BurnStats";

export default new class BurnCommand implements Command {
    description = "Burn your favorite token!"
    extended_description = `Burn your favorite token!. 

Examples:
**Burn one ${tokenNameToDisplayName("VITC")}**
.burn 1
**Burn one ${tokenNameToDisplayName("BAN")}**
.burn 1 ban`

    alias = ["burn"]
    usage = "<amount> {currency}"

    async execute(message:Message, args: string[], command: string){
        let [
            // eslint-disable-next-line prefer-const
            amount,
            currencyOrRecipient
        ] = args
        currencyOrRecipient = currencyOrRecipient || "vitc"
        if(!amount)return help.execute(message, [command])
        currencyOrRecipient = currencyOrRecipient.toUpperCase()

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
            await message.reply(`The token **${currencyOrRecipient}** is currently disabled, because: ${disabledTokens[tokenIds[currencyOrRecipient]]}`)
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

        const address = await discordqueue.queueAction(message.author.id, async () => {
            return getVITEAddressOrCreateOne(message.author.id, "Discord")
        })

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
            const totalAskedRaw = new BigNumber(convert(amountParsed, currencyOrRecipient, "RAW"))
            if(balance.isLessThan(totalAskedRaw)){
                try{
                    await message.react("❌")
                }catch{}
                await message.reply(
                    `You don't have enough money to cover this tip. You need **${amountParsed.toFixed()} ${tokenNameToDisplayName(currencyOrRecipient)}** but you only have **${convert(balance, "RAW", currencyOrRecipient)} ${tokenNameToDisplayName(currencyOrRecipient)}** in your balance. Use .deposit to top up your account.`
                )
                return
            }
            const tx = await requestWallet("burn", address.address, convert(amountParsed, currencyOrRecipient, "RAW"), token)
            const pair = tokenPrices[token+"/"+tokenIds.USDT]
            try{
                await Promise.all([
                    message.react("🔥"),
                    message.reply(`Burnt **${amountParsed.toFixed()} ${tokenNameToDisplayName(currencyOrRecipient)}** (= **$${
                        new BigNumber(pair?.closePrice || 0)
                        .times(amountParsed)
                        .decimalPlaces(2).toFixed(2)
                    }**).`),
                    BurnStats.create({
                        tokenId: token,
                        amount: amountParsed.toNumber(),
                        user_id: message.author.id,
                        txhash: Buffer.from(tx.hash, "hex")
                    })
                ])
            }catch{}
        })
    }
}