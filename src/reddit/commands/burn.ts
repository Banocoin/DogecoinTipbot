import { Comment, PrivateMessage } from "snoowrap";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import { disabledTokens, tokenIds } from "../../common/constants";
import BigNumber from "bignumber.js";
import { parseAmount } from "../../common/amounts";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import redditqueue from "../redditqueue";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import { tokenPrices } from "../../common/price";

export default new class BurnCommand implements Command {
    alias = ["burn"]
    usage = "";
    description = "Send a burn to someone";
    async executePublic(item: Comment, args: string[]): Promise<any> {
        let [
            // eslint-disable-next-line prefer-const
            amount,
            currency
        ] = args
        currency = currency || "vitc"
        if(!amount)return item.reply("Invalid Amount").then(()=>{})
        if(!currency)currency = "vitc"

        currency = currency.toUpperCase()

        if(!(currency in tokenIds)){
            await item.reply(`The token **${currency}** isn't supported.`)
                .then(()=>{})
        }
        if((tokenIds[currency] in disabledTokens)){
            await item.reply(`The token **${currency}** is currently disabled, because: ${disabledTokens[tokenIds[currency]]}`)
                .then(()=>{})
            return
        }
        let amountParsed:BigNumber
        try{
            amountParsed = parseAmount(amount, tokenIds[currency])
        }catch{
            return item.reply("Invalid Amount").then(()=>{})
        }
        if(amountParsed.isEqualTo(0)){
            await item.reply(`You can't send a tip of **0 ${tokenNameToDisplayName(currency)}**.`)
                .then(()=>{})
            return
        }
        
        const authorId = await item.author.id
        const address = await redditqueue.queueAction(authorId, async () => {
            return getVITEAddressOrCreateOne(authorId, "Reddit")
        })

        if(address.paused){
            return item.reply("Your account has been frozen, likely for using alts or abusing a faucet/rains. Please contact u/aThomized to unlock your account.").then(()=>{})
        }

        await viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const token = tokenIds[currency]
            const balance = new BigNumber(balances[token] || "0")
            const totalAskedRaw = new BigNumber(convert(amountParsed, currency, "RAW"))

            if(balance.isLessThan(totalAskedRaw)){
                return item.reply(`You don't have enough money to cover this burn. You need **${
                    amountParsed.toFixed()
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
                "burn",
                address.address, 
                amount, 
                token
            )
            const pair = tokenPrices[token+"/"+tokenIds.USDT]
            await item.reply(`🔥 Burnt **${
                convert(amount, "RAW", currency)
            } ${
                tokenNameToDisplayName(currency)
            }** (= **$${
                new BigNumber(pair?.closePrice || 0)
                .times(amountParsed)
                .decimalPlaces(2).toFixed(2)
            }**).
            
[\`${tx.hash}\`](https://vitcscan.com/tx/${tx.hash})`)
                .then(()=>{})
        })
    }

    async executePrivate(item: PrivateMessage): Promise<any> {
        return item.reply("Please execute this command in a comment.")
        .then(()=>{})
    }
}