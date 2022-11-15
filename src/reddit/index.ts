import "../common/load-env"
import { dbPromise } from "../common/load-db"
import Snoowrap from "snoowrap"
import { InboxStream } from "snoostorm"
import { walletReadyPromise } from "../cryptocurrencies/vite"
import Command from "./command"
import * as fs from "fs/promises"
import { join } from "path"
import RedditUsername from "../models/RedditUsername"

const BOT_START = Date.now() / 1000
export const client = new Snoowrap({
    userAgent: "VitaBot",
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD
})

export const commands = new Map<string, Command>()

;(async () => {
    await Promise.all([
        walletReadyPromise,
        dbPromise
    ])

    for(const file of await fs.readdir(join(__dirname, "commands"), {withFileTypes: true})){
        if(!file.isFile())continue
        if(!file.name.endsWith(".js") && !file.name.endsWith(".ts"))continue
        const mod = await import(join(__dirname, "commands", file.name))
        const command:Command = mod.default

        //if(!command.hidden)rawCommands.push(command)
        for(const alias of command.alias){
            commands.set(alias, command)
        }
    }

    const mentionRegexp = new RegExp(`^/?u/${process.env.REDDIT_USERNAME.toLowerCase()}$`)

    new InboxStream(client, {
        pollTime: 10000,
        limit: 30,
        filter: "inbox"
    }).on("item", async item => {
        if(item.created_utc < BOT_START)return
        if(!item.body.startsWith(process.env.DISCORD_PREFIX))return

        const args = item.body.slice(1).trim().split(/[\r\n ]+/)
        const command = args.shift().toLowerCase()

        const cmd = commands.get(command)
        if(!cmd)return
        
        try{
            await cmd.executePrivate(item as Snoowrap.PrivateMessage, args, command)
        }catch(err){
            console.error(err)
            await item.reply(`An error occured! \`${err.name?`${err.name}: ${err.message}` : JSON.stringify(err)}\``)
                .then(()=>{})
                .catch(()=>{})
        }
    })

    new InboxStream(client, {
        pollTime: 10000,
        limit: 30,
        filter: "mentions"
    }).on("item", async item => {
        if(item.created_utc < BOT_START)return

        // try to save the requester's username in our database
        try{
            const authorId = await item.author.id
            const authorName = await item.author.name
            const u = await RedditUsername.findOne({
                user_id: authorId
            })
            if(!u){
                await RedditUsername.create({
                    user_id: authorId,
                    username: authorName
                })
            }else if(u.username !== authorName){
                u.username = authorName
                await u.save()
            }
        }catch{}

        const args = item.body.trim().split(/[\r\n ]+/)
        for(let i = 0;i<args.length;i++){
            const arg = args[i]
            if(!mentionRegexp.test(arg.toLowerCase()))continue
            // we have a command
            const command = args[i+1]
            if(!command)continue

            const cmd = commands.get(command)
            if(!cmd)continue

            try{
                await cmd.executePublic(item as Snoowrap.Comment, args.slice(i+2), command)
            }catch(err){
                console.error(err)
                await item.reply(`An error occured! \`${err.name?`${err.name}: ${err.message}` : JSON.stringify(err)}\``)
                    .then(()=>{})
                    .catch(()=>{})
            }
            break
        }
    })
})()