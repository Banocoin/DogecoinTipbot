import BigNumber from "bignumber.js";
import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { tokenNameToDisplayName } from "../../common/convert";
import { tokenPrices } from "../../common/price";
import BurnStats from "../../models/BurnStats";
import Command from "../command";

export default new class TipStatsCommand implements Command {
    description = "Your burning stats"
    extended_description = `Display your burning stats.

Examples:
**See statistics**
.tipstats`

    alias = ["burnstats"]
    usage = ""

    async execute(message:Message, args: string[]){
        const currency = (args[0] || "vitc").toUpperCase()
        if(!(currency in tokenIds)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`The token **${currency}** isn't supported.`)
            return
        }
        const token = tokenIds[currency]
        const [
            numOfBurns,
            total,
            biggest
        ] = await Promise.all([
            BurnStats.countDocuments({
                user_id: message.author.id,
                tokenId: token
            }),
            BurnStats.aggregate([
                {
                    $match: {
                        user_id: message.author.id,
                        tokenId: token
                    }
                },
                {
                    $group: {
                        _id: "$user_id",
                        amount: {
                            $sum: "$amount"
                        }
                    }
                }
            ]),
            BurnStats.find({
                user_id: message.author.id,
                tokenId: token
            }).sort({amount: -1}).limit(1)
        ])
        
        let totalAmount = 0
        if(total[0]){
            totalAmount = Math.floor(total[0].amount*100)/100
        }
        let biggestAmount = 0
        if(biggest[0]){
            biggestAmount = Math.floor(biggest[0].amount*100)/100
        }
        
        const pair = tokenPrices[token+"/"+tokenIds.USDT]

        await message.reply(`You made **${numOfBurns}** burns totalling **${
            totalAmount
        } ${tokenNameToDisplayName(currency)}** (= **$${
            new BigNumber(pair?.closePrice || 0)
                .times(totalAmount)
                .decimalPlaces(2).toFixed(2)
        }**). Your biggest burn of all time is **${
            biggestAmount
        } ${tokenNameToDisplayName(currency)}** (= **$${
            new BigNumber(pair?.closePrice || 0)
                .times(biggestAmount)
                .decimalPlaces(2).toFixed(2)
        }**)`)
    }
}