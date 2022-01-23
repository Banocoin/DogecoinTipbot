import { Message } from "discord.js";
import { durationUnits } from "../../common/util";
import ActiveStats from "../../models/ActiveStats";
import ActiveStatus from "../../models/ActiveStatus";
import Command from "../command";
import { VITC_ADMINS, VITC_MODS } from "../constants";
import { generateDefaultEmbed } from "../util";

export default new class ActiveCommand implements Command {
    description = "Get a list of users activia"
    extended_description = `See a list of users that have sent a message in the last 5 minutes, or that have the active status.`
    alias = ["active"]
    usage = ""
    hidden = true

    async execute(message:Message){
        if(!message.guild){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        if(
            !VITC_ADMINS.includes(message.author.id) && 
            !VITC_MODS.includes(message.author.id) &&
            !message.member.permissions.has("MANAGE_CHANNELS")
        )return

        const [
            lastMessages,
            activia,
            activeMessages
        ] = await Promise.all([
            ActiveStats.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gt: new Date(Date.now()-durationUnits.m*30)
                        },
                        guild_id: message.guildId
                    }
                },
                {
                    $group: {
                        _id: "$user_id", 
                        createdAt: {
                            $max: "$createdAt"
                        }
                    }
                }
            ]),
            ActiveStatus.find({
                createdAt: {
                    $gt: new Date(Date.now()-durationUnits.m*30)
                },
                guild_id: message.guildId
            }),
            ActiveStats.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gt: new Date(Date.now()-durationUnits.m*5)
                        },
                        guild_id: message.guildId
                    }
                },
                {
                    $group: {
                        _id: "$user_id",
                        messageCount: {
                            $sum: "$num"
                        }
                    }
                }
            ])
        ])

        const messageCountForUser = (user:{_id:string}) => {
            return activeMessages.find(e => e._id === user._id)?.messageCount || 0
        }

        const list = lastMessages.sort((a, b) => {
            const [
                activiaA,
                activiaB
            ] = [
                activia.find(e => e.user_id === a._id),
                activia.find(e => e.user_id === b._id)
            ]
            if(activiaB && !activiaA)return 1
            if(activiaA && !activiaB)return -1
            return messageCountForUser(b)-messageCountForUser(a)
        }).map(user => {
            const isActive = !!activia.find(e => e.user_id === user._id)
            return `${
                isActive ? "**" : ""
            }<@${user._id}>:${
                messageCountForUser(user)
            } msg/5min. ${
                ""
            }Last msg: <t:${Math.floor(user.createdAt.getTime()/1000)}:R>${
                isActive ? "**" : ""
            }`
        })
        let first = true
        while(list[0]){
            let newLength = -1
            const newList = []
            while(list[0] && newLength + list[0].length + 1 < 4096){
                const elem = list.shift()
                newList.push(elem)
                newLength += 1 + elem.length
            }
            const embed = generateDefaultEmbed()
            .setTitle(`${activia.length} Active Members`)
            .setDescription(newList.join("\n"))

            const msg = await message.channel.send({
                embeds: [embed],
                ...(first ? {
                    reply: {
                        messageReference: message,
                        failIfNotExists: false
                    }
                } : {})
            })
            setTimeout(() => {
                msg.delete()
            }, 600000)
            first = false
        }
    }
}