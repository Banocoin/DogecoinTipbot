import "../common/load-env"
import { dbPromise, isDBReady } from "../common/load-db"
import TelegramBot from "node-telegram-bot-api"
import Command from "./command"
import { readdir } from "fs/promises"
import { join } from "path"
import ActionQueue from "../common/queue"
import TelegramUsername from "../models/TelegramUsername"
import express from "express"
import { isWalletReady, walletReadyPromise } from "../cryptocurrencies/vite"

const token = process.env.TELEGRAM_VITCTIPBOT
export const bot = new TelegramBot(token)
bot.setWebHook("https://telegram.vitamin.tips/bot"+token)
express()
.disable("x-powered-by")
.use(express.json())
.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
}).listen(3090, () => {
  console.log(`Express server is listening on ${3090}`);
})
export const username = "vitctipbot"

export const commands = new Map<string, Command>()

const skip = new Map<string|number, string|number>()
export const usernameAndIdQueue = new ActionQueue<string|number>()
bot.on("message", async message => {
    // Unreadable code sorry, it was 3 am
    // username already saved
    // save the username and the id in db, for mention tipping
    let resolve = () => {}
    const promise = new Promise<void>(r => {
        resolve = r
    })
    let idResolve = () => {}
    const idPromise = new Promise<void>(resolve => {
        idResolve = resolve
    })
    usernameAndIdQueue.queueAction(message.from.id, async () => {
        idResolve()
        await promise
    })
    let usernameResolve = () => {}
    const usernamePromise = new Promise<void>(resolve => {
        usernameResolve = resolve
    })
    usernameAndIdQueue.queueAction(message.from.username, async () => {
        usernameResolve()
        await promise
    })
    await Promise.all([
        idPromise,
        usernamePromise
    ])
    try{
        if(skip.get(message.from.id) == message.from.username)return
        const beforeUsername = skip.get(message.from.id)
        if(beforeUsername)skip.delete(beforeUsername)
        skip.delete(message.from.id)
        const beforeId = skip.get(message.from.username)
        if(beforeId)skip.delete(beforeId)
        skip.delete(message.from.username)
    
        // both usernames and ids are locked.
        const documents = await TelegramUsername.find({
            $or: [
                {
                    user_id: message.from.id
                },
                {
                    username: message.from.username
                }
            ]
        })
        const idDocument = documents.find(e => e.user_id === message.from.id)
        const usernameDocument = documents.find(e => e.username === message.from.username)
        if(!idDocument && !usernameDocument){
            await TelegramUsername.create({
                user_id: message.from.id,
                username: message.from.username
            })
        }else if(!idDocument){
            usernameDocument.username = null
            await usernameDocument.save()
        }else if(!usernameDocument){
            idDocument.username = message.from.username
            await idDocument.save()
        }else if(usernameDocument.user_id === idDocument.user_id){
            // already exists, do nothing.
        }else{
            // we have two differents usernames and shit, hold on
            usernameDocument.username = null
            idDocument.username = message.from.username
            await Promise.all([
                usernameDocument.save(),
                idDocument.save()
            ])
        }
        skip.set(message.from.id, message.from.username)
        skip.set(message.from.username, message.from.id)
        resolve()
    }catch(err){
        resolve()
        throw err
    }
})
bot.on("webhook_error", () => {})
bot.on("message", async message => {
    if(message.from.username === username)return
    if(message.from.is_bot)return
    if(!message.text?.startsWith("/"))return
    
    const args = message.text.slice(1).trim().split(/ +/g)
    let command = args.shift().toLowerCase()

    if(command.includes("@")){
        // /balance@vitctipbot
        const argv = command.split("@")
        if(argv[1] === username && !argv[2]){
            command = argv[0]
        }else return
    }

    const cmd = commands.get(command)
    if(!cmd)return

    if(!isWalletReady)await walletReadyPromise
    if(!isDBReady)await dbPromise
    try{
        await cmd.execute(message, args, command)
    }catch(err){
        console.error(err)
        if(!(err instanceof Error) && "error" in err){
            // eslint-disable-next-line no-ex-assign
            err = JSON.stringify(err.error, null, "    ")
        }
        await bot.sendMessage(message.chat.id, `The command ${command} threw an error! Sorry for the inconvenience! \`\`\`${err}\`\`\``, {
            reply_to_message_id: message.message_id,
            parse_mode: "Markdown"
        }).catch(()=>{})
    }
})

readdir(join(__dirname, "commands"), {withFileTypes: true})
.then(async files => {
    for(const file of files){
        if(!file.isFile())continue
        if(!file.name.endsWith(".js") && !file.name.endsWith(".ts"))continue
        const mod = await import(join(__dirname, "commands", file.name))
        const command:Command = mod.default

        //if(!command.hidden)rawCommands.push(command)
        for(const alias of command.alias){
            commands.set(alias, command)
        }
    }
})