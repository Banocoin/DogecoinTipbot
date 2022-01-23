import BigNumber from "bignumber.js"
import { Message } from "node-telegram-bot-api"
import { bot } from ".."
import { tokenIds, tokenTickers } from "../../common/constants"
import { convert, tokenNameToDisplayName } from "../../common/convert"
import { tokenPrices } from "../../common/price"
import viteQueue from "../../cryptocurrencies/viteQueue"
import { requestWallet } from "../../libwallet/http"
import { getVITEAddressOrCreateOne } from "../../wallet/address"
import Command from "../command"
import telegramqueue from "../telegramqueue"

export default new class BalanceCommand implements Command {
    usage = ""
    alias = ["balance", "bal"]

    async execute(message: Message): Promise<any> {
        if(message.chat.type !== "private"){
            await bot.sendMessage(message.chat.id, "Please execute this command in DMs.", {
                reply_to_message_id: message.message_id
            })
            return
        }
        const address = await telegramqueue.queueAction(message.from.id, async () => {
            return getVITEAddressOrCreateOne(String(message.from.id), "Telegram")
        })

        const balances = await viteQueue.queueAction(address.address, async () => {
            return requestWallet("get_balances", address.address)
        })

        for(const tokenId in balances){
            if(balances[tokenId] === "0")delete balances[tokenId]
        }
        if(!balances[tokenIds.VITC])balances[tokenIds.VITC] = "0"
        if(tokenIds["VINU-000"]){
            delete balances[tokenIds["VINU-000"]]
        }
        const lines = []
        let totalPrice = new BigNumber(0)
        for(const tokenId in balances){
            const name = tokenNameToDisplayName(tokenId)
            let line = `*${name}*`

            const displayToken = tokenTickers[tokenId] || tokenId
            const displayBalance = convert(balances[tokenId], "RAW", displayToken as any)

            const pair = tokenPrices[tokenId+"/"+tokenIds.USDT]

            const fiat = new BigNumber(pair?.closePrice || 0)
                .times(displayBalance)
                .decimalPlaces(2).toFixed(2)
            const bal = `${displayBalance} ${tokenTickers[tokenId] ? `*${tokenTickers[tokenId]}* ` : ""}(= *$${
                fiat
            }*)`
            line += " "+bal
            lines.push(line)
            
            totalPrice = totalPrice.plus(fiat)
        }

        lines.push("")
        lines.push(`Total Value: *$${totalPrice.decimalPlaces(2).toFixed(2)}*`)

        await bot.sendMessage(message.from.id, lines.join("\n"), {parse_mode: "Markdown"})
    }
}