import { Message } from "node-telegram-bot-api";
import { bot } from "..";
import { parseAmount } from "../../common/amounts";
import { dbPromise, isDBReady } from "../../common/load-db";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import telegramqueue from "../telegramqueue";
import * as vite from "@vite/vitejs"
import { tokenIds, tokenTickers } from "../../common/constants";
import { isWalletReady, walletReadyPromise } from "../../cryptocurrencies/vite";
import { AddressBlacklistedError, AddressFrozenError } from "../util";
import ExternalAddressBlacklist from "../../models/ExternalAddressBlacklist";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import BigNumber from "bignumber.js";
import { convert, tokenNameToDisplayName } from "../../common/convert";

export default new class WithdrawCommand implements Command {
    alias = ["withdraw", "send"]

    usage = "<amount|all> {currency} <address>"

    async execute(message: Message, args:string[], command:string): Promise<any> {
        if(message.chat.type !== "private"){
            await bot.sendMessage(message.chat.id, "Please execute this command in DMs.", {
                reply_to_message_id: message.message_id
            })
            return
        }
        let [
            // eslint-disable-next-line prefer-const
            amountRaw,
            currency,
            addr
        ] = args
        if(!amountRaw || !currency)return bot.sendMessage(
            message.chat.id,
            "Usage: "+this.usage,
            {
                reply_to_message_id: message.message_id
            }
        )
        let tokenId:string = null
        if(vite.wallet.isValidAddress(currency)){
            // there's no currency, it's an address
            addr = currency
            currency = "VITC"
            tokenId = tokenIds.VITC
        }else if(vite.utils.isValidTokenId(currency.toLowerCase())){
            currency = currency.toLowerCase()
            // raw token id
            tokenId = currency
            if(!isWalletReady)await walletReadyPromise
            if(tokenId in tokenTickers){
                currency = tokenTickers[tokenId]
            }
        }else{
            currency = currency.toUpperCase()
            if(!isWalletReady)await walletReadyPromise

            if(!(currency in tokenIds)){
                return bot.sendMessage(
                    message.chat.id,
                    `The token ${currency} isn't supported.`,
                    {
                        reply_to_message_id: message.message_id
                    }
                )
            }
            tokenId = tokenIds[currency]
        }
        if(amountRaw !== "all"){
            // try to parse it
            try{
                amountRaw = parseAmount(amountRaw, tokenId) as any
            }catch{
                // invalid amount
                return bot.sendMessage(
                    message.chat.id,
                    "Couldn't parse amount. Usage: "+this.usage,
                    {
                        reply_to_message_id: message.message_id
                    }
                )
            }
        }
        if(!addr || !vite.wallet.isValidAddress(addr))return bot.sendMessage(
            message.chat.id,
            "Invalid Address. Usage: "+this.usage,
            {
                reply_to_message_id: message.message_id
            }
        )
        if(!isDBReady)await dbPromise
        const address = await telegramqueue.queueAction(message.from.id, async () => {
            return getVITEAddressOrCreateOne(String(message.from.id), "Telegram")
        })
        if(address.paused){
            return AddressFrozenError(message, args, command)
        }else{
            const bl = await ExternalAddressBlacklist.findOne({
                address: addr
            })
            if(bl){
                address.paused = true;
                await address.save()
                return AddressBlacklistedError(message, args, command)
            }
        }

        await viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const balance = new BigNumber(balances[tokenId] || "0")
            const amount = new BigNumber(amountRaw === "all" ? balance : convert(amountRaw, currency, "RAW"))
            if(balance.isLessThan(amount)){
                return bot.sendMessage(
                    message.chat.id,
                    `You don't have enough money to cover this withdraw. You need *${convert(amount, "RAW", currency)} ${tokenNameToDisplayName(currency)}* but you only have *${convert(balance, "RAW", currency)} ${tokenNameToDisplayName(currency)}* in your balance.`,
                    {
                        parse_mode: "Markdown",
                        reply_to_message_id: message.message_id
                    }
                )
            }
            if(amount.isEqualTo(0) && amountRaw === "all"){
                return bot.sendMessage(
                    message.chat.id,
                    `You don't have anything in your account. Do /balance to find your get.`
                )
            }else if(amount.isEqualTo(0)){
                return bot.sendMessage(
                    message.chat.id,
                    `You can't send **0 ${tokenNameToDisplayName(currency)}**.`
                )
            }
            const tx = await requestWallet(
                "send",
                address.address, 
                addr, 
                amount.toFixed(), 
                tokenId
            )
            await bot.sendMessage(
                message.chat.id,
                `Your withdraw was processed!

View transaction on vitescan: https://vitescan.io/tx/${tx.hash}`,
                {
                    reply_to_message_id: message.message_id
                }
            )
        })
    }
}