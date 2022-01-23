import { Message } from "discord.js";
import { defaultEmoji, tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import { generateDefaultEmbed, throwBlacklistedAddressError, throwFrozenAccountError } from "../util";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import * as vite from "@vite/vitejs"
import { requestWallet } from "../../libwallet/http";
import ExternalAddressBlacklist from "../../models/ExternalAddressBlacklist";

export default new class WithdrawCommand implements Command {
    description = "Withdraw the funds on the tipbot"
    extended_description = `Withdraw your money to a personal wallet.

Examples:
**Withdraw all your ${tokenNameToDisplayName("VITC")} to your wallet**
.withdraw all vite_addr
**Withdraw 1 ${tokenNameToDisplayName("VITC")} to your wallet**
.Withdraw 1 vite_addr
**Withdraw all your ${tokenNameToDisplayName("BAN")} to your wallet**
.withdraw all BAN vite_addr
**Withdraw 1 ${tokenNameToDisplayName("BAN")} to your wallet**
.Withdraw 1 BAN vite_addr`

    alias = ["withdraw", "send"]
    usage = "<amount|all> {currency} <vite_addr>"

    async execute(message:Message, args: string[], command: string){
        if(message.guild){
            await message.reply("Please execute this command in DMs")
            return
        }
        let [
            // eslint-disable-next-line prefer-const
            amountRaw,
            currencyOrRecipient,
            addr
        ] = args
        if(!amountRaw || !currencyOrRecipient)return help.execute(message, [command])
        if(!/^\d+(\.\d+)?$/.test(amountRaw) && amountRaw !== "all")return help.execute(message, [command])
        if(vite.wallet.isValidAddress(currencyOrRecipient)){
            // user here
            addr = currencyOrRecipient
            currencyOrRecipient = "vitc"
        }
        let isRawTokenId = false
        currencyOrRecipient = currencyOrRecipient.toUpperCase()

        if(!(currencyOrRecipient in tokenIds)){
            if(vite.utils.isValidTokenId(currencyOrRecipient.toLowerCase())){
                isRawTokenId = true
                currencyOrRecipient = currencyOrRecipient.toLowerCase()
            }else{
                const embed = generateDefaultEmbed()
                .setDescription(`The token ${currencyOrRecipient} isn't supported.`)
                await message.channel.send({
                    embeds: [embed]
                })
                return
            }
        }
        /*
        Allow them to withdraw shit tokens lol
        if((tokenIds[currencyOrRecipient] in disabledTokens)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`The token **${currencyOrRecipient}** is currently disabled, because: ${disabledTokens[tokenIds[currencyOrRecipient]]}`)
            return
        }*/
        if(!addr)return help.execute(message, [command])

        const address = await discordqueue.queueAction(message.author.id, async () => {
            return getVITEAddressOrCreateOne(message.author.id, "Discord")
        })
        if(address.paused){
            await throwFrozenAccountError(message, args, command)
        }else{
            const bl = await ExternalAddressBlacklist.findOne({
                address: addr
            })
            if(bl){
                address.paused = true;
                await address.save()
                return throwBlacklistedAddressError(message, args, command)
            }
        }

        await viteQueue.queueAction(address.address, async () => {
            try{
                await message.react(defaultEmoji)
            }catch{}
            const balances = await requestWallet("get_balances", address.address)
            const token = isRawTokenId ? currencyOrRecipient : tokenIds[currencyOrRecipient]
            const balance = new BigNumber(token ? balances[token] || "0" : "0")
            const amount = new BigNumber(amountRaw === "all" ? balance : convert(amountRaw, currencyOrRecipient, "RAW"))
            if(balance.isLessThan(amount)){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send({
                    content: `You don't have enough money to cover this withdraw. You need ${convert(amount, "RAW", currencyOrRecipient)} ${currencyOrRecipient} but you only have ${convert(balance, "RAW", currencyOrRecipient)} ${currencyOrRecipient} in your balance.`,
                    reply: {
                        messageReference: message,
                        failIfNotExists: false
                    }
                })
                return
            }
            if(amount.isEqualTo(0)){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send({
                    content: `You can't send **0 ${tokenNameToDisplayName(currencyOrRecipient)}**.`,
                    reply: {
                        messageReference: message,
                        failIfNotExists: false
                    }
                })
                return
            }
            const tx = await requestWallet(
                "send",
                address.address, 
                addr, 
                amount.toFixed(), 
                token
            )
            try{
                await message.react("909408282307866654")
            }catch{}
            await message.channel.send({
                content: `Your withdraw was processed!

View transaction on vitescan: https://vitescan.io/tx/${tx.hash}`,
                reply: {
                    messageReference: message,
                    failIfNotExists: false
                }
            })
        })
    }
}