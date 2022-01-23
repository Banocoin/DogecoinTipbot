import BigNumber from "bignumber.js";
import { Message } from "node-telegram-bot-api";
import { bot } from "..";
import { parseAmount } from "../../common/amounts";
import { disabledTokens, tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import TelegramUsername from "../../models/TelegramUsername";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import { SendTransaction } from "../../wallet/events";
import Command from "../command";
import telegramqueue from "../telegramqueue";
import { AddressFrozenError } from "../util";

const InvalidAmountError = (message:Message) => bot.sendMessage(
    message.chat.id,
    "Invalid Amount",
    {
        reply_to_message_id: message.message_id
    }
)

export default new class TipCommand implements Command {
    alias = ["tip"];
    usage = "<amount> {currency} <...@someone>"

    async execute(message: Message, args: string[], command): Promise<any> {
        let [
            // eslint-disable-next-line prefer-const
            amount,
            currencyOrRecipient
        ] = args
        currencyOrRecipient = currencyOrRecipient || "vitc"
        if(!amount)return InvalidAmountError(message)
        if(currencyOrRecipient.startsWith("@"))currencyOrRecipient = "vitc"
        currencyOrRecipient = currencyOrRecipient.toUpperCase()

        if(!(currencyOrRecipient in tokenIds)){
            await bot.sendMessage(message.chat.id, `The token **${currencyOrRecipient}** isn't supported.`, {
                reply_to_message_id: message.message_id
            })
            return
        }
        if((tokenIds[currencyOrRecipient] in disabledTokens)){
            await bot.sendMessage(message.chat.id, `The token **${currencyOrRecipient}** is currently disabled, because: ${disabledTokens[tokenIds[currencyOrRecipient]]}`, {
                reply_to_message_id: message.message_id
            })
            return
        }
        
        let amountParsed:BigNumber
        try{
            amountParsed = parseAmount(amount, tokenIds[currencyOrRecipient])
        }catch{
            await InvalidAmountError(message)
            return
        }
        if(amountParsed.isEqualTo(0)){
            await bot.sendMessage(message.chat.id, `You can't send a tip of **0 ${tokenNameToDisplayName(currencyOrRecipient)}**.`, {
                reply_to_message_id: message.message_id
            })
            return
        }
        
        const recipients = []
        const promises = []
        for(const entity of message.entities || []){
            promises.push((async () => {
                try{
                    switch(entity.type){
                        case "mention": {
                            const username = message.text.slice(entity.offset+1, entity.offset+entity.length)
                            if(username === message.from.username)return
                            const user = await TelegramUsername.findOne({
                                username
                            })
                            if(!user){
                                await bot.sendMessage(message.chat.id, `I can't resolve user @${username}, make sure the user sent a message in a chat where the bot is present at least once. This user will not be tipped. Warning: Usernames are case sensitive.`, {
                                    reply_to_message_id: message.message_id
                                })
                                return
                            }
                            recipients.push(user.user_id)
                            break
                        }
                        case "text_mention": {
                            recipients.push(entity.user.id)
                        }
                    }
                }catch(err){
                    console.error(err)
                }
            })())
        }
        await Promise.all(promises)
        if(recipients.length === 0){
            await bot.sendMessage(
                message.chat.id, 
                `Couldn't parse any recipient in your message.`, 
                {
                    reply_to_message_id: message.message_id
                }
            )
            return
        } 
        const totalAsked = amountParsed.times(recipients.length)

        const [
            address,
            addresses
        ] = await Promise.all([
            telegramqueue.queueAction(message.from.id, async () => {
                return getVITEAddressOrCreateOne(message.from.id.toString(), "Telegram")
            }),
            Promise.all(recipients.map(async (recipient) => {
                return telegramqueue.queueAction(recipient, async () => {
                    return getVITEAddressOrCreateOne(recipient.toString(), "Telegram")
                })
            }))
        ])

        if(address.paused){
            await AddressFrozenError(message, args, command)
            return
        }

        await viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const token = tokenIds[currencyOrRecipient]
            const balance = new BigNumber(token ? balances[token] || "0" : "0")
            const totalAskedRaw = new BigNumber(convert(totalAsked, currencyOrRecipient, "RAW"))
            if(balance.isLessThan(totalAskedRaw)){
                await bot.sendMessage(
                    message.chat.id,
                    `You don't have enough money to cover this tip. You need *${totalAsked.toFixed()} ${tokenNameToDisplayName(currencyOrRecipient)}* but you only have *${convert(balance, "RAW", currencyOrRecipient)} ${tokenNameToDisplayName(currencyOrRecipient)}* in your balance. Use /deposit to top up your account.`,
                    {
                        reply_to_message_id: message.message_id,
                        parse_mode: "Markdown"
                    }
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
                        addresses.map(e => [
                            e.address,
                            amount
                        ]), 
                        token,
                        addresses.length > i*chunk+chunk ? 75000 : 0
                    )
                    txs = txs.concat(tx[1])
                }
                bot.sendMessage(
                    message.chat.id,
                    `Split *${convert(new BigNumber(amount).times(addresses.length), "RAW", currencyOrRecipient)} ${tokenNameToDisplayName(currencyOrRecipient)}* to *${addresses.length} recipients*`,
                    {
                        parse_mode: "Markdown",
                        reply_to_message_id: message.message_id
                    }
                )
            }else{
                const amount = convert(amountParsed, currencyOrRecipient, "RAW")
                await requestWallet(
                    "send",
                    address.address, 
                    addresses[0].address, 
                    amount, 
                    token
                )
                bot.sendMessage(
                    message.chat.id,
                    `Sent *${convert(amount, "RAW", currencyOrRecipient)} ${tokenNameToDisplayName(currencyOrRecipient)}* to *1 recipient*`,
                    {
                        parse_mode: "Markdown",
                        reply_to_message_id: message.message_id
                    }
                )
            }
        })
    }
    
}