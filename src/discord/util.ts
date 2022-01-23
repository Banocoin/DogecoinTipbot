import { MessageEmbed, Message, WebhookClient } from "discord.js";
import { client } from ".";
import { VITC_COLOR } from "../common/constants";
import ActionQueue from "../common/queue";
import DiscordRainRoles from "../models/DiscordRainRoles";

export function generateDefaultEmbed(){
    return new MessageEmbed()
    .setColor(VITC_COLOR)
    .setFooter(client.user?.username || "VitaBot", client.user?.avatarURL({
        dynamic: true
    }))
}

export const discordSettingsQueue = new ActionQueue<string>()
export const discordRainRolesCache = new Map<string, string[]>()
export function findDiscordRainRoles(guild_id: string){
    return discordSettingsQueue.queueAction(guild_id, async () => {
        if(discordRainRolesCache.has(guild_id))return discordRainRolesCache.get(guild_id)

        const roles = await DiscordRainRoles.find({
            guild_id: guild_id
        })
        const rids = roles.map(e => e.role_id)
        discordRainRolesCache.set(guild_id, rids)
        return rids
    })
}

export const USER_PATTERN = /^<@!?(?<id>\d{17,19})>$/
export const USER_PATTERN_MULTI = /<@!?(\d{17,19})>/g
export const ID_PATTERN = /^\d{17,19}$/
export const ROLE_PATTERN = /^<@&(?<id>\d{17,19})>$/
export const ROLE_PATTERN_MULTI = /<@&(\d{17,19})>/g
export function isDiscordUserArgument(arg: string){
    return USER_PATTERN.test(arg) || 
        ID_PATTERN.test(arg) || 
        ROLE_PATTERN.test(arg) ||
        USER_PATTERN_MULTI.test(arg) || 
        ROLE_PATTERN_MULTI.test(arg)
}
export async function parseDiscordUser(arg: string){
    if(USER_PATTERN.test(arg)){
        const parsed = arg.match(USER_PATTERN)
        try{
            const user = await client.users.fetch(parsed.groups.id)
            return [user]
        }catch{
            return []
        }
    }else if(USER_PATTERN_MULTI.test(arg)){
        const matches = [...arg.matchAll(USER_PATTERN_MULTI)]
        const ids:string[] = []
        for(const match of matches){
            if(ids.includes(match[1]))continue
            ids.push(match[1])
        }
        
        return (await Promise.all([...new Set(ids)].map(id => {
            return client.users.fetch(id).catch((err) => {
                console.error(err)
                return null
            })
        }))).filter(e => !!e)
    }else if(ID_PATTERN.test(arg)){
        try{
            const user = await client.users.fetch(arg)
            return [user]
        }catch{
            return []
        }
    }else if(ROLE_PATTERN.test(arg)){
        const parsed = arg.match(ROLE_PATTERN)
        try{
            const guild = client.guilds.cache.find(e => e.roles.cache.has(parsed.groups.id))
            if(!guild)return []
            const members = await guild.members.fetch()
            return members.filter(e => 
                e.roles.cache.has(parsed.groups.id) && 
                !e.user.bot
            ).map(e => e.user)
        }catch{
            return []
        }
    }else if(ROLE_PATTERN_MULTI.test(arg)){
        const matches = arg.match(ROLE_PATTERN_MULTI)
        const ids:string[] = []
        for(const match of matches){
            if(ids.includes(match[1]))continue
            ids.push(match[1])
        }
        return (await Promise.all([...ids].map(async id => {
            try{
                const guild = client.guilds.cache.find(e => e.roles.cache.has(id))
                if(!guild)return []
                const members = await guild.members.fetch()
                return members.filter(e => 
                    e.roles.cache.has(id) && 
                    !e.user.bot
                ).map(e => e.user)
            }catch{
                return []
            }
        }))).flat().filter(e => !!e)
    }
    return []
}

export const blWebhook = new WebhookClient({
    url: process.env.WEBHOOK_INSPECTOR
})

export async function throwFrozenAccountError(message:Message, args: string[], command: string){
    await blWebhook.send(
        `An action was requested, but was blocked because account is frozen.
        
<@${message.author.id}> (${message.author.tag}): ${command} ${JSON.stringify(args)}`
    ).catch(()=>{})
    throw new Error("Your account has been frozen, likely for using alts or abusing a faucet/rains. Please contact an admin to unlock your account.")
}
export async function throwBlacklistedAddressError(message:Message, args: string[], command: string){
    await blWebhook.send({
        content: `<@&908950288860319745> Please review this new blacklist.
        
An action was requested, but was blocked because withdraw address is blacklisted.
        
<@${message.author.id}> (${message.author.tag}): ${command} ${JSON.stringify(args)}
`,
        allowedMentions: {
            roles: ["908950288860319745"]
        }
}).catch(()=>{})
    throw new Error("Your account has been frozen, likely for withdrawing to a blacklisted address. Please contact an admin to unlock your account.")
}