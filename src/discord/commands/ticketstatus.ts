import BigNumber from "bignumber.js";
import { Message } from "discord.js";
import { defaultEmoji, tokenIds } from "../../common/constants";
import { tokenNameToDisplayName } from "../../common/convert";
import { tokenPrices } from "../../common/price";
import Giveaway from "../../models/Giveaway";
import GiveawayEntry from "../../models/GiveawayEntry";
import Command from "../command";
import { generateDefaultEmbed } from "../util";

export default new class TicketStatusCommand implements Command {
    description = "See the status of your giveaway entry"
    extended_description = `See the status of your entry.
Will display the amount you paid in fees, the time, and the transaction on VITCScan.

**See the status of your giveaway entry.**
${process.env.DISCORD_PREFIX}ts`
    alias = ["ticketstatus", "ts"]
    usage = ""

    async execute(message:Message){
        if(!message.guildId){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        try{
            await message.react(defaultEmoji)
        }catch{}
        const giveaway = await Giveaway.findOne({
            guild_id: message.guildId
        })
        if(!giveaway){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`No giveaways were found.`)
            return
        }

        const entry = await GiveawayEntry.findOne({
            user_id: message.author.id,
            message_id: giveaway.message_id
        })
        if(!entry){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`You didn't participate in the current giveaway yet. Please do \`${process.env.DISCORD_PREFIX}ticket\` to enter this giveaway!`)
            return
        }
        const pair = tokenPrices[tokenIds.VITC+"/"+tokenIds.USDT]
        const embed = generateDefaultEmbed()
        .setTitle("Giveaway Entry")
        .setDescription(`Fee paid: **${giveaway.fee} ${tokenNameToDisplayName("VITC")}** (= **$${
            new BigNumber(pair?.closePrice || 0)
                .times(giveaway.fee)
                .decimalPlaces(2).toFixed(2)
        }**)
Entered **<t:${Math.floor(entry.date.getTime()/1000)}:R>**
[View Vitescan](https://vitcscan.com/tx/${entry.txhash})`)
        await message.author.send({
            embeds: [embed]
        })
        try{
            await message.react("909408282307866654")
        }catch{}
    }
}