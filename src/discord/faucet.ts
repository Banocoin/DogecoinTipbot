import { client, sentHashes } from "."
import { defaultEmoji, tokenIds, VITABOT_GITHUB } from "../common/constants"
import { durationUnits } from "../common/util"
import { getVITEAddressOrCreateOne } from "../wallet/address"
import viteQueue from "../cryptocurrencies/viteQueue"
import FaucetCooldown from "../models/FaucetCooldown"
import discordqueue from "./discordqueue"
import BigNumber from "bignumber.js"
import { convert } from "../common/convert"
import { generateDefaultEmbed } from "./util"
import { requestWallet } from "../libwallet/http"
import { VITC_ADMINS } from "./constants"
import fetch from "node-fetch"

export const FAUCET_CHANNEL_ID = "863555276849807380"
export const FAUCET_CHANNEL_ID_VITAMINHEAD = "889401673196404756"
export const NEW_FAUCET_CHANNEL_ID = "907362906847461406"
export let FAUCET_PAYOUT = new BigNumber(convert("25", "VITC", "RAW"))
export let FAUCET_PAYOUT_VITAMINHEAD = new BigNumber(convert("50", "VITC", "RAW"))
export const FAUCET_PAYOUT_USD = new BigNumber("0.125")
export const FAUCET_PAYOUT_VITAMINHEAD_USD = new BigNumber("0.25")

export async function fetchPrice(){
    // fetch vitc price
    const res = await fetch("https://api.vitex.net/api/v2/exchange-rate?tokenIds="+tokenIds.VITC)
    const json = await res.json()
    if(json.code !== 0)throw new Error(json.msg)
    const vitc = json.data[0]
    if(!vitc)throw new Error("No price found wtf")

    const usdPrice = new BigNumber(vitc.usdRate)

    FAUCET_PAYOUT = new BigNumber(convert(FAUCET_PAYOUT_USD.div(usdPrice), "VITC", "RAW"))
    FAUCET_PAYOUT_VITAMINHEAD = new BigNumber(convert(FAUCET_PAYOUT_VITAMINHEAD_USD.div(usdPrice), "VITC", "RAW"))
}

fetchPrice()
setInterval(fetchPrice, 60000)

export async function initFaucet(){
    const address = await getVITEAddressOrCreateOne("VitaBot", "Faucet")
    console.info(`Faucet address: ${address.address}`)

    client.on("messageCreate", async (message) => {
        if(![
            FAUCET_CHANNEL_ID, 
            FAUCET_CHANNEL_ID_VITAMINHEAD, 
            NEW_FAUCET_CHANNEL_ID
        ].includes(message.channelId))return
        if(message.author.bot){
            if(message.author.id !== client.user.id)await message.delete()
            return
        }
        const isAdmin = VITC_ADMINS.includes(message.author.id)
        if(isAdmin)return
        const payout = message.channel.id !== FAUCET_CHANNEL_ID ? FAUCET_PAYOUT_VITAMINHEAD : FAUCET_PAYOUT
        try{
            await discordqueue.queueAction(message.author.id+".faucet", async () => {
                let cooldown = await FaucetCooldown.findOne({
                    user_id: message.author.id
                })
                if(cooldown){
                    // 23 hrs
                    const cooldownDuration = 23*durationUnits.h
                    if(message.createdAt.getTime() < cooldown.date.getTime() + cooldownDuration){
                        const timestamp = Math.floor((cooldown.date.getTime()+cooldownDuration)/1000)
                        await message.author.send(
                            `You will be able to post <t:${timestamp}:R>. Please wait until <t:${timestamp}> before posting again in <#${message.channel.id}>.`
                        )
                        throw new Error()
                    }else{
                        cooldown.date = message.createdAt
                        await cooldown.save()
                    }
                }else{
                    cooldown = await FaucetCooldown.create({
                        user_id: message.author.id,
                        date: message.createdAt
                    })
                }
            })
        }catch{
            await message.delete()
            return
        }
        try{
            try{
                await message.react(defaultEmoji)
            }catch{}
            const recipient = await discordqueue.queueAction(message.author.id, async () => {
                return getVITEAddressOrCreateOne(message.author.id, "Discord")
            })
            await viteQueue.queueAction(address.address, async () => {
                const balances = await requestWallet("get_balances", address.address)
                const balance = new BigNumber(balances[tokenIds.VITC]||0)
                if(balance.isLessThan(payout)){
                    try{
                        await message.react("❌")
                    }catch{}
                    await message.reply(
                        `The faucet balance is lower than the payout. Please wait until an admin tops up the account.`
                    )
                    return
                }
                const tx = await requestWallet(
                    "send",
                    address.address, 
                    recipient.address, 
                    payout.toFixed(), 
                    tokenIds.VITC
                )
                sentHashes.add(tx.hash)
                setTimeout(() => {
                    sentHashes.delete(tx.hash)
                }, 60000);
                try{
                    await message.react("909408282307866654")
                }catch{}
            })
        }catch(err){
            try{
                await message.react("❌")
            }catch{}
            console.error(err)
            if(!(err instanceof Error) && "error" in err){
                // eslint-disable-next-line no-ex-assign
                err = JSON.stringify(err.error, null, "    ")
            }
            message.channel.send({
                content: `The faucet threw an error! Sorry for the inconvenience! Please report this to VitaBot's github:`,
                embeds: [
                    generateDefaultEmbed()
                    .setDescription("```"+err+"```")
                    .setAuthor("Go to VitaBot's github", undefined, VITABOT_GITHUB)
                ],
                reply: {
                    messageReference: message,
                    failIfNotExists: false
                }
            })
        }
    })
}