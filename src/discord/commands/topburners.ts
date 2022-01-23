import BigNumber from "bignumber.js";
import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { tokenNameToDisplayName } from "../../common/convert";
import { tokenPrices } from "../../common/price";
import BurnStats from "../../models/BurnStats";
import Command from "../command";
import { VITC_ADMINS } from "../constants";
import { generateDefaultEmbed, parseDiscordUser } from "../util";

export default new class TopBurnersCommand implements Command {
    description = "See the bot's top burners"
    extended_description = `Display a list of the best burners.

Examples:
**See top burners**
.topburners`

    alias = ["topburners"]
    usage = ""

    async execute(message:Message, args:string[]){
        const currency = (args[0] || "vitc").toUpperCase()
        if(!(currency in tokenIds)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`The token **${currency}** isn't supported.`)
            return
        }
        const token = tokenIds[currency]
        const adminsOnly = args[1] === "admins"
        const [
            topBurners,
            totalBurnt
        ] = await Promise.all([
            BurnStats.aggregate([
                {
                    $match: {
                        tokenId: token
                    }
                },
                {
                    $group: {
                        _id: "$user_id",
                        sum: {
                            $sum: "$amount"
                        }
                    }
                }
            ]),
            BurnStats.aggregate([
                {
                    $match: {
                        tokenId: token
                    }
                },
                {
                    $group: {
                        _id: "$tokenId",
                        amount: {
                            $sum: "$amount"
                        }
                    }
                }
            ])
        ])
        const topBurnns = topBurners
        .filter(e => {
            if(token === tokenIds.VITC)return !adminsOnly ? !VITC_ADMINS.includes(e._id) : VITC_ADMINS.includes(e._id)
            return true
        })
        .sort((a, b) => b.sum-a.sum)
        .slice(0, 15)
        
        const burners = await Promise.all(
            topBurnns.map(async e => {
                return {
                    amount: e.sum,
                    user: (await parseDiscordUser(e._id))[0]
                }
            })
        )
        
        let totalAmount = 0
        if(totalBurnt[0]){
            totalAmount = Math.floor(totalBurnt[0].amount*100)/100
        }

        const pair = tokenPrices[token+"/"+tokenIds.USDT]

        const embed = generateDefaultEmbed()
        .setDescription(`**Top 15 Burners 🔥**
        
${burners.map((burner, i) => {
    return `${i+1}. **${Math.floor(burner.amount*100)/100} ${currency}**  (= **$${
        new BigNumber(pair?.closePrice || 0)
            .times(burner.amount)
            .decimalPlaces(2).toFixed(2)
    }**) - By **${burner.user?.tag}${i==0?" 👑":""}**`
}).join("\n") || "Looks like the list is empty..."}

Total Amount Burnt: **${totalAmount} ${tokenNameToDisplayName(currency)}** (= **$${
    new BigNumber(pair?.closePrice || 0)
        .times(totalAmount)
        .decimalPlaces(2).toFixed(2)
}**)`)


        await message.reply({
            embeds: [embed]
        })
    }
}