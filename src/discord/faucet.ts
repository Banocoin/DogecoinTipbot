import { client } from "."
import { tokenIds, VITABOT_GITHUB } from "../common/constants"
import { durationUnits } from "../common/util"
import { getBalances, getVITEAddressOrCreateOne, sendVITE } from "../cryptocurrencies/vite"
import viteQueue from "../cryptocurrencies/viteQueue"
import FaucetCooldown from "../models/FaucetCooldown"
import discordqueue from "./discordqueue"
import BigNumber from "bignumber.js"
import { convert } from "../common/convert"
import { generateDefaultEmbed } from "./util"

export const FAUCET_CHANNEL_ID = "863555276849807380"
export const FAUCET_PAYOUT = new BigNumber(convert("50", "VITC", "RAW"))

export async function initFaucet(){
    const address = await getVITEAddressOrCreateOne("VitaBot", "Faucet")
    console.info(`Faucet address: ${address.address}`)

    client.on("messageCreate", async (message) => {
        if(message.channel.id !== FAUCET_CHANNEL_ID)return
        if(message.author.bot){
            if(message.author.id !== client.user.id)await message.delete()
            return
        }
        const isAdmin = message.member.roles.cache.has("862755971000172579") || message.member.roles.cache.has("871009109237960704")
        if(isAdmin)return
        try{
            await discordqueue.queueAction(message.author.id+".faucet", async () => {
                let cooldown = await FaucetCooldown.findOne({
                    user_id: message.author.id
                })
                if(cooldown){
                    if(Date.now() < cooldown.date.getTime() + durationUnits.d){
                        const timestamp = Math.floor((cooldown.date.getTime()+durationUnits.d)/1000)
                        await message.author.send(
                            `You will be able to post <t:${timestamp}:R>. Please wait until <t:${timestamp}> before posting again in <#${FAUCET_CHANNEL_ID}>.`
                        )
                        throw new Error()
                    }else{
                        cooldown.date = new Date()
                        await cooldown.save()
                    }
                }else{
                    cooldown = await FaucetCooldown.create({
                        user_id: message.author.id,
                        date: new Date()
                    })
                }
            })
        }catch{
            await message.delete()
            return
        }
        try{
            try{
                await message.react("💊")
            }catch{}
            const recipient = await discordqueue.queueAction(message.author.id, async () => {
                return getVITEAddressOrCreateOne(message.author.id, "Discord")
            })
            await viteQueue.queueAction(address.address, async () => {
                const balances = await getBalances(address.address)
                const balance = new BigNumber(balances[tokenIds.VITC])
                if(balance.isLessThan(FAUCET_PAYOUT)){
                    try{
                        await message.react("❌")
                    }catch{}
                    await message.reply(
                        `The faucet balance is lower than the payout. Please wait until an admin tops up the account.`
                    )
                    return
                }
                await sendVITE(
                    address.seed, 
                    recipient.address, 
                    FAUCET_PAYOUT.toFixed(), 
                    tokenIds.VITC
                )
                try{
                    await message.react("873558842699571220")
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
                content: `The faucet throwed an error ! Sorry for the inconvenience ! Please report this to VitaBot's github:`,
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