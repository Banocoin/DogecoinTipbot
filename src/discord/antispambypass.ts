// This file is used to bypass the ban on dming people on Discord
// Simply require they dmed the bot at least once.
// If the bot isn't restricted, it'll just go through the normal flow
import { DMChannel, User } from "discord.js";
import ActionQueue from "../common/queue";
import DiscordDMChannel from "../models/DiscordDMChannel";

export const nocheckcache = new Set<string>()
export const createDMQueue = new ActionQueue<string>()
const createDM = User.prototype.createDM as (force?:boolean) => Promise<DMChannel>
User.prototype.createDM = async function(force = false){
    return createDMQueue.queueAction(this.id, async () => {
        if(force)return createDM.call(this, force)
        if(this.dmChannel && !this.dmChannel.partial) return this.dmChannel
    
        // Alright, need to fetch from database if we have it.
        // If we do have it, create a mock channel
        // if we don't, fetch from Discord.
        const channel = await DiscordDMChannel.findOne({
            bot_id: this.client.user.id,
            user_id: this.id
        })
        if(!channel)return createDM.call(this, false)
        // Add mock channel to the cache.
        return this.client.channels._add({
            id: channel.channel_id,
            type: 1,
            last_message_id: null,
            recipients: [
                {
                    username: this.username,
                    discriminator: this.discriminator,
                    id: this.id,
                    avatar: this.avatar
                }
            ]
        })
    })

}