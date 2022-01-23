import { Message } from "discord.js";
import { tos } from "../../common/constants";
import Command from "../command";

export default new class InviteCommand implements Command {
    description = "Displays Terms of Service"
    extended_description = `Displays Terms of Service`

    alias = ["tos"]
    usage = ""

    async execute(message:Message){
        await message.author.send({
            embeds: [tos.embed]
        })
        if(message.guild){
            await message.reply("I've sent my terms of service in your dms!")
        }
    }
}