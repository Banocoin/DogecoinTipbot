import BigNumber from "bignumber.js";
import { Message } from "node-telegram-bot-api";
import { bot } from "..";
import { parseAmount } from "../../common/amounts";
import { disabledTokens, tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { tokenPrices } from "../../common/price";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
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
    alias = ["burn"];
    usage = "<amount> {currency}"

    async execute(message: Message, args: string[], command): Promise<any> {
        let [
            // eslint-disable-next-line prefer-const
            amount,
            currency
        ] = args
        currency = currency || "vitc"
        if(!amount)return InvalidAmountError(message)
        currency = currency.toUpperCase()

        if(!(currency in tokenIds)){
            await bot.sendMessage(message.chat.id, `The token *${currency}* isn't supported.`, {
                reply_to_message_id: message.message_id,
                parse_mode: "Markdown"
            })
            return
        }
        if((tokenIds[currency] in disabledTokens)){
            await bot.sendMessage(message.chat.id, `The token *${currency}* is currently disabled, because: ${disabledTokens[tokenIds[currency]]}`, {
                reply_to_message_id: message.message_id,
                parse_mode: "Markdown"
            })
            return
        }
        
        let amountParsed:BigNumber
        try{
            amountParsed = parseAmount(amount, tokenIds[currency])
        }catch{
            await InvalidAmountError(message)
            return
        }
        if(amountParsed.isEqualTo(0)){
            await bot.sendMessage(message.chat.id, `You can't send a tip of *0 ${tokenNameToDisplayName(currency)}*.`, {
                reply_to_message_id: message.message_id,
                parse_mode: "Markdown"
            })
            return
        }
        
        const address = await telegramqueue.queueAction(message.from.id, async () => {
            return getVITEAddressOrCreateOne(message.from.id.toString(), "Telegram")
        })

        if(address.paused){
            await AddressFrozenError(message, args, command)
            return
        }

        await viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const token = tokenIds[currency]
            const balance = new BigNumber(token ? balances[token] || "0" : "0")
            const totalAskedRaw = new BigNumber(convert(amountParsed, currency, "RAW"))
            if(balance.isLessThan(totalAskedRaw)){
                await bot.sendMessage(
                    message.chat.id,
                    `You don't have enough money to cover this burn. You need *${amountParsed.toFixed()} ${tokenNameToDisplayName(currency)}* but you only have *${convert(balance, "RAW", currency)} ${tokenNameToDisplayName(currency)}* in your balance. Use /deposit to top up your account.`,
                    {
                        reply_to_message_id: message.message_id,
                        parse_mode: "Markdown"
                    }
                )
                return
            }
            await requestWallet("burn", address.address, convert(amountParsed, currency, "RAW"), token)
            const pair = tokenPrices[token+"/"+tokenIds.USDT]
            await bot.sendMessage(
                message.chat.id,
                `Burnt *${amountParsed.toFixed()} ${tokenNameToDisplayName(currency)}* (= *$${
                    new BigNumber(pair?.closePrice || 0)
                    .times(amountParsed)
                    .decimalPlaces(2).toFixed(2)
                }*).`,
                {
                    reply_to_message_id: message.message_id,
                    parse_mode: "Markdown"
                }
            )
        })
    }
    
}