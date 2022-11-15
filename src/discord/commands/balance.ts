import { Message } from "discord.js";
import { tokenIds, tokenTickers } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import Command from "../command";
import discordqueue from "../discordqueue";
import { generateDefaultEmbed } from "../util";
import { tokenPrices } from "../../common/price";
import BigNumber from "bignumber.js";

export default new class BalanceCommand implements Command {
    description = "Get your balance"
    extended_description = "Get the balance in your tipbot account."
    alias = ["balance", "bal"]
    usage = ""

    async execute(message:Message){
        const address = await discordqueue.queueAction(message.author.id, async () => {
            return getVITEAddressOrCreateOne(message.author.id, "Discord")
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
        if(tokenIds["NYA-000"]){
            delete balances[tokenIds["NYA-000"]]
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

        const embed = generateDefaultEmbed()
        .setAuthor({
            name: "View on VITCScan",
            url: `https://vitcscan.com/address/${address.address}`
        })
        .setDescription(lines.join("\n"))
        await message.author.send({
            embeds: [embed]
        })
        if(message.guild){
            message.reply("I've sent your balance in your DM!")
        }
    }
}