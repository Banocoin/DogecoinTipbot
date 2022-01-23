import BigNumber from "bignumber.js";
import { Message } from "node-telegram-bot-api";
import { bot } from "..";
import { parseAmount } from "../../common/amounts";
import { disabledTokens, RAIN_MIN, RAIN_MIN_WHITELISTED, tokenDecimals, tokenIds, tokenTickers } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { tokenPrices } from "../../common/price";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { BulkSendResponse, requestWallet } from "../../libwallet/http";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import { getActiveUsers } from "../ActiviaManager";
import Command from "../command";
import telegramqueue from "../telegramqueue";
import { AddressFrozenError } from "../util";

export default new class StartCommand implements Command {
    alias = ["rain"]

    usage = "<amount> {currency}"

    async execute(message: Message, args:string[], command:string): Promise<any> {
        if(message.chat.type == "private" || message.chat.type == "channel"){
            await bot.sendMessage(message.chat.id, "Please execute this command in a group.", {
                reply_to_message_id: message.message_id
            })
            return
        }
        const amountRaw = args[0]
        if(!amountRaw){
            await bot.sendMessage(message.chat.id, "Invalid Amount", {
                reply_to_message_id: message.message_id
            })
            return
        }
        const currency = (args[1] || "vitc").toUpperCase()
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
        const token = tokenIds[currency]
        const amount = parseAmount(amountRaw, token)
        const rainMinStr = RAIN_MIN_WHITELISTED[token] || RAIN_MIN
        let rainMin:BigNumber
        try{
            rainMin = parseAmount(rainMinStr, token)
        }catch{
            // No price for token ? kek just discard
            await bot.sendMessage(message.chat.id, `This token can't be rained because it doesn't have a price yet. To whitelist it, please contact @aThomized.`, {
                reply_to_message_id: message.message_id
            })
            return
        }
        if(amount.isLessThan(rainMin)){
            await bot.sendMessage(message.chat.id, `The minimum amount to rain is *${rainMinStr} ${tokenNameToDisplayName(token)}*.`, {
                reply_to_message_id: message.message_id,
                parse_mode: "Markdown"
            })
            return
        }
        const userList = (await getActiveUsers(message.chat.id))
            .filter(e => e !== message.from.id)
        if(userList.length < 2){
            await bot.sendMessage(message.chat.id, `There are less than *2 active users* (${userList.length} active users). Cannot rain.`, {
                reply_to_message_id: message.message_id,
                parse_mode: "Markdown"
            })
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
            telegramqueue.queueAction(message.from.id, async () => {
                return getVITEAddressOrCreateOne(String(message.from.id), "Telegram")
            }),
            Promise.all(userList.map(id => {
                return telegramqueue.queueAction(id, async () => {
                    return getVITEAddressOrCreateOne(String(id), "Telegram")
                })
            }))
        ])

        if(address.paused){
            await AddressFrozenError(message, args, command)
            return
        }

        await viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const balance = new BigNumber(balances[token] || 0)
            const totalAskedRaw = new BigNumber(convert(totalAsked, currency, "RAW"))
            if(balance.isLessThan(totalAskedRaw)){
                await bot.sendMessage(
                    message.chat.id,
                    `You don't have enough money to cover this tip. You need *${totalAsked.toFixed()} ${tokenNameToDisplayName(currency)}* but you only have *${convert(balance, "RAW", currency)} ${tokenNameToDisplayName(currency)}* in your balance. Use /deposit to top up your account.`,
                    {
                        reply_to_message_id: message.message_id,
                        parse_mode: "Markdown"
                    }
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
            const pair = tokenPrices[token+"/"+tokenIds.USDT]
            await bot.sendMessage(
                message.chat.id,
                `Distributed *${convert(totalAskedRaw, "RAW", tokenTickers[token])} ${tokenNameToDisplayName(token)}* (= *$${
                    new BigNumber(pair?.closePrice || 0)
                    .times(totalAsked)
                    .decimalPlaces(2).toFixed(2)
                }*) amongst *${userList.length} active members*!`,
                {
                    parse_mode: "Markdown",
                    reply_to_message_id: message.message_id
                }
            )
        })
    }
}