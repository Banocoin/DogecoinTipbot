import { Message } from "discord.js";
import Command from "../command";
import { FAUCET_CHANNEL_ID, FAUCET_PAYOUT, FAUCET_PAYOUT_VITAMINHEAD } from "../faucet";
import BigNumber from "bignumber.js"
import help from "./help";
import { convert } from "../../common/convert";
import { client } from "..";
import discordqueue from "../discordqueue";
import FaucetCooldown from "../../models/FaucetCooldown";
import { IAddress } from "../../models/Address";
import { durationUnits } from "../../common/util";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { defaultEmoji, tokenIds } from "../../common/constants";
import { BOT_OWNER, VITC_ADMINS } from "../constants";
import { requestWallet } from "../../libwallet/http";

export default new class ClearFaucetCommand implements Command {
    description = "Clear stuck transactions in the faucet"
    extended_description = `Unstuck the faucet.`
    alias = ["clearfaucet"]
    usage = "{messages} {amount}"
    hidden = true

    async execute(message:Message, args: string[], command: string){
        if(message.author.id !== BOT_OWNER)return
        //if(message.channelId !== FAUCET_CHANNEL_ID)return
        
        let [
            messageCountRaw,
            // eslint-disable-next-line prefer-const
            amountRaw
        ] = args
        if(!messageCountRaw)messageCountRaw = "100"
        if(!/^\d+$/.test(messageCountRaw)){
            await help.execute(message, [command])
            return
        }
        const messageCount = parseInt(messageCountRaw)
        if(messageCount > 500 || messageCount === 0){
            await help.execute(message, [command])
            return
        }
        let rawAmount = message.channel.id !== FAUCET_CHANNEL_ID ? FAUCET_PAYOUT_VITAMINHEAD : FAUCET_PAYOUT
        
        if(amountRaw){
            if(!/^\d+(\.\d+)?$/.test(amountRaw)){
                await help.execute(message, [command])
                return
            }
            const amount = new BigNumber(amountRaw)
            if(amount.isGreaterThan(100)){
                await message.reply("That amount is too big.")
                return
            }

            if(amount.isLessThan(50)){
                await message.reply("That amount is too small.")
                return
            }

            rawAmount = new BigNumber(convert(amount, "VITC", "RAW"))
        }

        const messages:Message[] = []
        let remaining = messageCount
        let lastMessageId = message.id
        while(remaining > 1){
            const msgs = await message.channel.messages.fetch({
                before: lastMessageId,
                limit: remaining > 100 ? 100 : remaining
            })
            remaining = remaining-(remaining > 100 ? 100 : remaining)
            if(msgs.size === 0){
                remaining = 0
            }
            lastMessageId = msgs.last().id
            for(const message of msgs.values()){
                messages.push(message)
            }
        }

        try{
            await message.react(defaultEmoji)
        }catch{}
        const recipients:IAddress[] = []
        const address = await getVITEAddressOrCreateOne("VitaBot", "Faucet")
        const validMsgs:Message[] = []
        for(let message of messages){
            if(message.author.bot){
                if(message.author.id !== client.user.id)await message.delete()
                continue
            }
            // Looks like we already tried to process that one.
            if(message.reactions.cache.has(defaultEmoji)){
                if(message.reactions.cache.has("909408282307866654"))continue
            }
            message = await message.fetch()
            const isAdmin = VITC_ADMINS.includes(message.author.id)
            if(isAdmin)continue
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
                continue
            }
            try{
                validMsgs.push(message)
                if(!message.reactions.cache.has(defaultEmoji))await message.react(defaultEmoji)
            }catch{}
            try{
                const recipient = await discordqueue.queueAction(message.author.id, async () => {
                    return getVITEAddressOrCreateOne(message.author.id, "Discord")
                })
                recipients.push(recipient)
            }catch{}
        }
        // Bulk send transactions.
        await viteQueue.queueAction(address.address, async () => {
            const totalAsked = rawAmount.times(recipients.length)
            const balances = await requestWallet("get_balances", address.address)
            const balance = new BigNumber(balances[tokenIds.VITC])
            if(balance.isLessThan(totalAsked)){
                try{
                    await message.react("❌")
                }catch{}
                for(const message of validMsgs){
                    try{
                        await message.react("❌")
                    }catch{}
                }
                await message.reply(
                    `The faucet balance is lower than the payout. Please wait until an admin tops up the account.`
                )
                return
            }
            if(recipients.length > 1){
                await requestWallet(
                    "bulk_send",
                    address.address,
                    recipients.map(e => [
                        e.address,
                        rawAmount.toFixed(0)
                    ]),
                    tokenIds.VITC
                )
            }else if(recipients.length === 1){
                await requestWallet(
                    "send",
                    address.address,
                    recipients[0].address,
                    rawAmount.toFixed(0),
                    tokenIds.VITC
                )
            }
            try{
                await message.react("909408282307866654")
            }catch{}
            for(const message of validMsgs){
                try{
                    await message.react("909408282307866654")
                }catch{}
            }
        })
    }
}