import "../common/load-env"
import Discord, { Collection, TextChannel } from "discord.js"
import {promises as fs} from "fs"
import { join } from "path"
import Command from "./command"
import { generateDefaultEmbed, parseDiscordUser } from "./util"
import { disabledServers, tokenTickers, VITABOT_GITHUB } from "../common/constants"
import { dbPromise } from "../common/load-db"
import { FAUCET_CHANNEL_ID, FAUCET_CHANNEL_ID_VITAMINHEAD, NEW_FAUCET_CHANNEL_ID, initFaucet } from "./faucet"
import { getAirdropEmbed, searchAirdrops, watchingAirdropMap } from "./AirdropManager"
import { durationUnits } from "../common/util"
import { searchGiveaways } from "./GiveawayManager"
import { walletConnection } from "../cryptocurrencies/vite"
import Address from "../models/Address"
import { convert, tokenNameToDisplayName } from "../common/convert"
import { allowedServersBots, BOT_OWNER, VITC_ADMINS, whitelistedBots } from "./constants"
import { parseTransactionType } from "../wallet/address"
import "./ModsDistributionManager"
import { createDMQueue, nocheckcache } from "./antispambypass"
import DiscordDMChannel from "../models/DiscordDMChannel"
import viteQueue from "../cryptocurrencies/viteQueue"
import DiscordLinkedWallet from "../models/DiscordLinkedWallet"
import { requestWallet } from "../libwallet/http"
import WalletLinkingSecret from "../models/WalletLinkingSecret"
import { randomBytes } from "crypto"
import APIProject from "../models/APIProject"

export const discordBotId = process.argv[2]
export const deprecatedBots = process.env.DISCORD_DEPRECATED_BOT.split(",")
export const publicBot = process.env.DISCORD_PUBLIC_BOT

export const sentHashes = new Set<string>()

export const client = new Discord.Client({
    allowedMentions: {
        repliedUser: true
    },
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.DIRECT_MESSAGES,
        Discord.Intents.FLAGS.GUILD_MEMBERS,
        Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS
    ],
    partials: [
        "MESSAGE",
        "USER",
        "GUILD_MEMBER",
        "REACTION",
        "CHANNEL"
    ],
    presence: {
        activities: [{
            name: "Popping pills 💊",
            type: "PLAYING"
        }]
    }
})

export const commands = new Collection<string, Command>()
export const rawCommands = [] as Command[]
let botRegexp:RegExp = null

client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`)

    botRegexp = new RegExp("^<@!?"+client.user.id+">$")
    // every hour
    setTimeout(searchAirdrops, durationUnits.h)
    
    searchAirdrops()
    .catch(()=>{})

    searchGiveaways()
    .catch(console.error)

    if(publicBot !== client.user.id && !deprecatedBots.includes(client.user.id)){
        // private bot
        initFaucet()
        
        walletConnection.on("tx", async transaction => {
            if(transaction.type !== "receive")return
            
            const address = await Address.findOne({
                address: transaction.to
            })
            // shouldn't happen but
            if(!address)return

            // don't send notifications on random coins.
            if(!(transaction.token_id in tokenTickers))return
            
            const tokenName = tokenTickers[transaction.token_id]
            const displayNumber = convert(
                transaction.amount, 
                "RAW", 
                tokenName
            )
            let text = `

View transaction on VITCScan: https://vitcscan.com/tx/${transaction.hash}`

            const sendingAddress = await Address.findOne({
                address: transaction.from,
                network: "VITE"
            })
            const notif = parseTransactionType(sendingAddress?.handles?.[0], transaction.sender_handle)
            text = notif.text
                .replace("{amount}", `${displayNumber} ${tokenNameToDisplayName(tokenName)}`)
                + text
            switch(notif.type){
                case "rewards":
                case "airdrop":
                    return

                case "tip": {
                    let mention = ""
                    if(notif.platform == "Discord"){
                        const user = (await parseDiscordUser(notif.id))[0]
                        if(user)mention = user.tag
                    }else if(notif.platform == "Twitter"){
                        mention = `https://twitter.com/i/user/${notif.id}`
                    }else{
                        mention = `${notif.platform}:${notif.id}`
                    }
                    text = text.replace("{mention}", mention)
                    break
                }
                
                case "bank": {
                    const project = await APIProject.findOne({
                        project_id: notif.project_id
                    })
                    text = text.replace("{name}", project.name)
                }
            }
            const [id] = address.handles[0].split(".")
            switch(address.handles[0].split(".").slice(1).join(".")){
                case "Discord": {
                    if(notif.type === "tip" && !sentHashes.has(transaction.from_hash))return
                    const user = await client.users.fetch(id)
                    if(!user)return
                    user.send(text).catch(()=>{})
                    break
                }
                case "Discord.Airdrop": {
                    const airdrop = watchingAirdropMap.get(id)
                    if(!airdrop)return
                    const channel = client.channels.cache.get(airdrop.channel_id) as TextChannel
                    const [
                        message,
                        embed
                    ] = await Promise.all([
                        channel.messages.fetch(airdrop.message_id),
                        getAirdropEmbed(airdrop)
                    ])
                    await message.edit({
                        embeds: [embed]
                    })
                    break
                }
                case "Discord.Link": {
                    // Add to linked wallets
                    const user = await client.users.fetch(id)
                    if(!user)return
                    await viteQueue.queueAction(transaction.to, async () => {
                        // Need to check the memo
                        const [
                            sendBlock,
                            secret
                        ] = await Promise.all([
                            requestWallet("get_account_block", transaction.from_hash),
                            WalletLinkingSecret.findOne({
                                address: address
                            })
                        ])
                        if(!secret)return
                        const memo = Buffer.from(sendBlock.data || "", "base64")
                        if(!memo.equals(Buffer.from(secret.secret, "hex"))){
                            await user.send(`You tried to link \`${transaction.from}\` to your Discord Account, but the secret was invalid. Contact <@${BOT_OWNER}> if you think there's an issue.`).catch(()=>{})
                            return
                        }
                        const exists = await DiscordLinkedWallet.findOne({
                            address: transaction.from
                        })
                        if(exists){
                            await user.send(`You tried to link \`${transaction.from}\` to your Discord Account, but this address is already linked with <@${exists.user}>. Contact <@${BOT_OWNER}> if you think there's an issue.`).catch(()=>{})
                        }else{
                            await DiscordLinkedWallet.create({
                                user: id,
                                address: transaction.from
                            })
                            // Change the secret
                            secret.secret = randomBytes(64).toString("hex")
                            await secret.save()
                            await user.send(`Successfully linked \`${transaction.from}\` with your Discord Account!`).catch(()=>{})
                        }
                    })
                }
            }
        })
    }else if(publicBot === client.user.id){
        // public bot
        initFaucet()
        
        walletConnection.on("tx", async transaction => {
            if(transaction.type !== "receive")return
            
            const address = await Address.findOne({
                address: transaction.to
            })
            // shouldn't happen but
            if(!address)return

            if(!(transaction.token_id in tokenTickers))return

            /*const sendingAddress = await Address.findOne({
                address: transaction.from,
                network: "VITE"
            })*/
            
            //const notif = parseTransactionType(sendingAddress?.handles?.[0], transaction.sender_handle)
            for(const handle of address.handles){
                const [id] = handle.split(".")
                switch(handle.split(".").slice(1).join(".")){
                    case "Discord.Airdrop": {
                        const airdrop = watchingAirdropMap.get(id)
                        if(!airdrop)return
                        const channel = client.channels.cache.get(airdrop.channel_id) as TextChannel
                        const [
                            message,
                            embed
                        ] = await Promise.all([
                            channel.messages.fetch(airdrop.message_id),
                            getAirdropEmbed(airdrop)
                        ])
                        await message.edit({
                            embeds: [embed]
                        })
                    }
                }
            }
        })
    }
})

const prefix = process.env.DISCORD_PREFIX
client.on("messageCreate", async message => {
    if(message.author.id === client.user.id)return
    if(!message.guild && !nocheckcache.has(message.author.id)){
        nocheckcache.add(message.author.id)
        createDMQueue.queueAction(message.author.id, async () => {
            const channel = await DiscordDMChannel.findOne({
                bot_id: client.user.id,
                user_id: message.author.id
            })
            if(!channel){
                await DiscordDMChannel.create({
                    bot_id: client.user.id,
                    user_id: message.author.id,
                    channel_id: message.channel.id
                })
            }
        })
    }
    if([FAUCET_CHANNEL_ID, FAUCET_CHANNEL_ID_VITAMINHEAD, NEW_FAUCET_CHANNEL_ID].includes(message.channel.id)){
        if(!VITC_ADMINS.includes(message.author.id))return
    }
    if(botRegexp.test(message.content)){
        message.reply("Hi! If you're wondering, my prefix is `"+prefix+"`! You can see my list of commands by doing `"+prefix+"help`! 💊")
        return
    }
    // lol bananoman servers
    if(disabledServers[message.guildId]){
        // Why are we even here
        await message.guild.leave()
        return
    }
    if(!message.content.startsWith(prefix))return
    if(message.author.bot){
        // exceptions lol
        if(!whitelistedBots.includes(message.author.id))return
        if(allowedServersBots[message.author.id]){
            if(!allowedServersBots[message.author.id].includes(message.guildId))return
        }
    }
    const args = message.content.slice(prefix.length).trim().split(/ +/g)
    const command = args.shift().toLowerCase()

    const cmd = commands.get(command)
    if(!cmd)return

    try{
        if(deprecatedBots.includes(message.client.user.id)){
            if(message.guild){
                await message.reply(`Hi! We just changed our bots. Please add the new one here: https://discord.com/oauth2/authorize?client_id=${publicBot}&permissions=515399609408&scope=bot`)
            }else{
                await message.reply(`Hi! We just changed our bots. Please contact the new one here: <@${publicBot}>`)
            }
        }
        await cmd.execute(message, args, command)
    }catch(err){
        console.error(err)
        if(!(err instanceof Error) && "error" in err){
            // eslint-disable-next-line no-ex-assign
            err = JSON.stringify(err.error, null, "    ")
        }
        message.channel.send({
            content: `The command ${command} threw an error! Sorry for the inconvenience! Please report this to VitaBot's github:`,
            embeds: [
                generateDefaultEmbed()
                .setDescription("```"+err+"```")
                .setAuthor("Go to VitaBot's github", undefined, VITABOT_GITHUB)
            ],
            reply: {
                messageReference: message,
                failIfNotExists: false
            }
        }).catch(()=>{})
    }
})

// Prevent stupid crashes
client.on("error", () => {})

fs.readdir(join(__dirname, "commands"), {withFileTypes: true})
.then(async files => {
    for(const file of files){
        if(!file.isFile())continue
        if(!file.name.endsWith(".js") && !file.name.endsWith(".ts"))continue
        const mod = await import(join(__dirname, "commands", file.name))
        const command:Command = mod.default

        if(!command.hidden)rawCommands.push(command)
        for(const alias of command.alias){
            commands.set(alias, command)
        }
    }
    // wait for db before launching bot
    await dbPromise
    await client.login(process.env[`DISCORD_TOKEN_${discordBotId}`])
})