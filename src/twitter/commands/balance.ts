import { DMMessage, twitc } from "..";
import { tokenIds, tokenTickers } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { formatNumber } from "../../common/amounts";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import twitterqueue from "../twitterqueue";

export default new class BalanceCommand implements Command {
    public = false
    dm = true
    description = "Display your balance"
    extended_description = `Display your current balance`
    alias = ["balance", "bal"]
    usage = ""

    async executePrivate(message:DMMessage){
        await this.sendBalanceToUser(message.user.id)
    }

    async sendBalanceToUser(user_id: string){
        const address = await twitterqueue.queueAction(user_id, async () => {
            return getVITEAddressOrCreateOne(user_id, "Twitter")
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

        await twitc.v1.sendDm({
            recipient_id: user_id, 
            text: `Your current balance:
        
${Object.keys(balances).map(tokenId => {
    const displayToken = tokenTickers[tokenId] || tokenId
    const displayBalance = convert(balances[tokenId], "RAW", displayToken as any)

    return `${tokenNameToDisplayName(displayToken)}: ${formatNumber(displayBalance)}`
}).join("\n")}`

// View on VITCScan: https://vitcscan.com/address/${address.address}
        })
    }
}