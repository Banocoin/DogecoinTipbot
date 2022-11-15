import { Comment, PrivateMessage } from "snoowrap";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import { tokenIds } from "../../common/constants";
import BigNumber from "bignumber.js";
import { parseAmount } from "../../common/amounts";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { blWebhook } from "../util";
import redditqueue from "../redditqueue";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import { tokenPrices } from "../../common/price";
import * as vite from "@vite/vitejs"
import ExternalAddressBlacklist from "../../models/ExternalAddressBlacklist";

export default new class WithdrawCommand implements Command {
    alias = ["withdraw", "send"]
    usage = "<amount> {currency} <address>";
    description = "Withdraw your money from the tipbot";
    async executePublic(item: Comment): Promise<any> {
        return item.reply(`Please execute this command in DMs.`)
            .then(()=>{})
    }

    async executePrivate(item: PrivateMessage, args: string[], command: string): Promise<any> {
        let [
            // eslint-disable-next-line prefer-const
            amount,
            currency,
            // eslint-disable-next-line prefer-const
            withdrawAddress
        ] = args
        if(currency && vite.wallet.isValidAddress(currency)){
            withdrawAddress = currency
            currency = "vitc"
        }
        if(
            !amount ||
            !currency ||
            !withdrawAddress || 
            !vite.wallet.isValidAddress(withdrawAddress)
        )return item.reply(`Usage: ${process.env.DISCORD_PREFIX}${command} ${this.usage}`).then(()=>{})
        
        currency = currency.toUpperCase()

        if(!(currency in tokenIds)){
            await item.reply(`The token **${currency}** isn't supported.`)
                .then(()=>{})
        }
        let amountParsed:BigNumber
        try{
            amountParsed = parseAmount(amount, tokenIds[currency])
        }catch{
            return item.reply("Invalid Amount").then(()=>{})
        }
        if(amountParsed.isEqualTo(0)){
            await item.reply(`You can't send a withdraw **0 ${tokenNameToDisplayName(currency)}**.`)
                .then(()=>{})
            return
        }
        
        const authorId = await item.author.id
        const [
            address,
            blacklist
        ] = await Promise.all([
            redditqueue.queueAction(authorId, async () => {
                return getVITEAddressOrCreateOne(authorId, "Reddit")
            }),
            ExternalAddressBlacklist.findOne({
                address: withdrawAddress
            })
        ])

        if(address.paused){
            return item.reply("Your account has been frozen, likely for using alts or abusing a faucet/rains. Please contact u/aThomized to unlock your account.").then(()=>{})
        }
        if(blacklist){
            address.paused = true
            await address.save()
            await blWebhook.send({
                content: `Please review this new blacklist.
    
An action was requested, but was blocked because withdraw address is blacklisted.

u/${await item.author.name} (${await item.author.id}): ${command} ${JSON.stringify(args)}`,
                allowedMentions: {
                    roles: ["908950288860319745"]
                }
            })
            return item.reply("Your account has been frozen, likely for using alts or abusing a faucet/rains. Please contact u/aThomized to unlock your account.").then(()=>{})
        }

        await viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const token = tokenIds[currency]
            const balance = new BigNumber(balances[token] || "0")
            const totalAskedRaw = new BigNumber(convert(amountParsed, currency, "RAW"))

            if(balance.isLessThan(totalAskedRaw)){
                return item.reply(`You don't have enough money to cover this tip. You need **${
                    new BigNumber(convert(totalAskedRaw, "RAW", currency)).toFixed()
                } ${
                    tokenNameToDisplayName(currency)
                }** but you only have **${
                    convert(balance, "RAW", currency)
                } ${
                    tokenNameToDisplayName(currency)
                }** in your balance. Use .deposit to top up your account.`)
                .then(()=>{})
            }

            const amount = convert(amountParsed, currency, "RAW")
            const tx = await requestWallet(
                "send",
                address.address, 
                withdrawAddress, 
                amount, 
                token
            )
            const pair = tokenPrices[token+"/"+tokenIds.USDT]
            await item.reply(`Withdrawn **${
                convert(amount, "RAW", currency)
            } ${
                tokenNameToDisplayName(currency)
            }** (= **$${
                new BigNumber(pair?.closePrice || 0)
                .times(amountParsed)
                .decimalPlaces(2).toFixed(2)
            }**) to [\`${withdrawAddress}\`](https://vitcscan.com/address/${withdrawAddress})
            
[\`${tx.hash}\`](https://vitcscan.com/tx/${tx.hash})`)
                .then(()=>{})
        })
    }
}