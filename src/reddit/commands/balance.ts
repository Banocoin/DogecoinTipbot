import { Comment, PrivateMessage } from "snoowrap";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import redditqueue from "../redditqueue";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import { tokenIds, tokenTickers } from "../../common/constants";
import BigNumber from "bignumber.js";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { tokenPrices } from "../../common/price";

export default new class BalanceCommand implements Command {
    alias = ["balance", "bal"]
    usage = "";
    description = "Display your balance";
    async executePublic(item: Comment): Promise<any> {
        await item.reply("Please execute this command in DMs.")
            .then(() => {})
    }
    async executePrivate(item: PrivateMessage): Promise<any> {
        // WHY IS THE FUCKING ID A FUCKING PROMISE
        const id = await item.author.id
        const address = await redditqueue.queueAction(id, async () => {
            return await getVITEAddressOrCreateOne(id, "Reddit")
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
            let line = `**${name}**`

            const displayToken = tokenTickers[tokenId] || tokenId
            const displayBalance = convert(balances[tokenId], "RAW", displayToken as any)

            const pair = tokenPrices[tokenId+"/"+tokenIds.USDT]

            const fiat = new BigNumber(pair?.closePrice || 0)
                .times(displayBalance)
                .decimalPlaces(2).toFixed(2)
            const bal = `${displayBalance} ${tokenTickers[tokenId] ? `**${tokenTickers[tokenId]}** ` : ""}(= **$${
                fiat
            }**)`
            line += " "+bal
            lines.push(line)
            
            totalPrice = totalPrice.plus(fiat)
        }

        lines.push("")
        lines.push(`Total Value: **$${totalPrice.decimalPlaces(2).toFixed(2)}**`)

        await item.reply(lines.join("\n"))
            .then(()=>{})
    }
    
}