import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getBalances, getVITEAddressOrCreateOne, sendVITE, viteEvents } from "../../cryptocurrencies/vite";
import Command from "../command";
import discordqueue from "../discordqueue";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import rain from "./rain";
import * as lt from "long-timeout"
import { resolveDuration } from "../../common/util";
import Giveaway from "../../models/Giveaway";
import { throwFrozenAccountError } from "../util";
import GiveawayEntry from "../../models/GiveawayEntry";
import { endGiveaway, giveawayQueue, resolveGiveaway, startGiveaway, timeoutsGiveway, watchingGiveawayMap } from "../GiveawayManager";
import Tip from "../../models/Tip";

export default new class GiveawayCommand implements Command {
    description = "Start a new giveaway"
    extended_description = `Start a new giveaway!
Your giveaway will be queued by channel.

Examples:
**Start a ${tokenNameToDisplayName("VITC")} giveaway!**
.giveaway 100 30m 20`

    alias = ["giveaway", "gstart"]
    usage = "<amount> <duration> {fee}"

    async execute(message:Message, args: string[], command: string){
        if(![
            "112006418676113408",
            "696481194443014174",
            "871221803580813373"
        ].includes(message.author.id)){
            await message.channel.send("That command is limited to Thomiz. Please don't use it.")
            return
        }
        if(!message.guildId || !rain.allowedGuilds.includes(message.guildId)){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        const [
            amount,
            durationRaw
        ] = args
        let [
            ,,feeRaw
        ] = args
        if(!amount || !/^\d+(\.\d+)?$/.test(amount))return help.execute(message, [command])
        if(!durationRaw)return help.execute(message, [command])
        if(!feeRaw){
            feeRaw = "0"
        }
        if(!/^\d+(\.\d+)?$/.test(feeRaw) || feeRaw.length > 5)return help.execute(message, [command])
        const currency = "VITC"
        const maxDurationStr = "1h"
        const maxDuration = resolveDuration(maxDurationStr)
        const minDurationStr = "1m"// 5m
        const minDuration = resolveDuration(minDurationStr)
        const [
            baseAmount,
            tokenId,
            duration,
            fee
        ] = [
            new BigNumber(amount),
            tokenIds[currency],
            resolveDuration(durationRaw),
            new BigNumber(new BigNumber(feeRaw)
            .times(100).toFixed().split(".")[0]).div(100)
        ]
        try{
            await message.react("💊")
        }catch{}
        if(baseAmount.isLessThan(100)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(
                `The base amount for that giveaway is too low. You need at least 1k VITC.`
            )
            return
        }
        if(duration > maxDuration){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(
                `The duration for that giveaway is too long. The maximum is ${maxDurationStr}.`
            )
            return
        }
        if(duration < minDuration){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(
                `The duration for that giveaway is too short. The minimum is ${minDurationStr}.`
            )
            return
        }
        if(fee.isGreaterThan(0)){
            if(fee.isLessThan(1)){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send(
                    `The fee for that giveaway is too low. Please set 0, or at least 1 vitc`
                )
                return
            }
            if(baseAmount.isLessThan(fee)){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send(
                    `The base amount for that giveaway is too low. You need at least the fee amount.`
                )
                return
            }

            const [
                address,
                giveawayLockedAddress
            ] = await discordqueue.queueAction(message.author.id, async () => {
                return Promise.all([
                    getVITEAddressOrCreateOne(message.author.id, "Discord"),
                    getVITEAddressOrCreateOne(message.id, "Discord.Giveaway"),
                ])
            })
    
            if(address.paused){
                await throwFrozenAccountError(message, args, command)
            }

            const giveaway = await viteQueue.queueAction(address.address, async () => {
                try{
                    await message.react("💊")
                }catch{}
                const balances = await getBalances(address.address)
                const balance = new BigNumber(balances[tokenId] || "0")
                const totalAmountRaw = new BigNumber(convert(baseAmount, "VITC", "RAW"))
                if(balance.isLessThan(totalAmountRaw)){
                    try{
                        await message.react("❌")
                    }catch{}
                    await message.author.send(
                        `You don't have enough money to create this giveaway. You need ${baseAmount.toFixed()} ${currency} but you only have ${convert(balance, "RAW", currency)} ${currency} in your balance. Use .deposit to top up your account.`
                    )
                    return
                }
                const hash = await sendVITE(
                    address.seed, 
                    giveawayLockedAddress.address, 
                    totalAmountRaw.toFixed(), 
                    tokenId
                )
                const [
                    giveaway
                ] = await Promise.all([
                    Giveaway.create({
                        duration: Number(duration),
                        creation_date: null,
                        bot_message_id: null,
                        message_id: message.id,
                        channel_id: message.channel.id,
                        guild_id: message.guild.id,
                        user_id: message.author.id,
                        fee: parseFloat(
                            fee.toFixed()
                        )
                    }),
                    GiveawayEntry.create({
                        user_id: message.author.id,
                        message_id: message.id,
                        date: new Date(),
                        txhash: hash
                    }),
                    Tip.create({
                        amount: parseFloat(fee.toFixed()),
                        user_id: message.author.id,
                        date: new Date(),
                        txhash: hash
                    }),
                    new Promise(r => {
                        viteEvents.once("receive_"+hash, r)
                    })
                ])
                // money locked
                try{
                    await message.react("873558842699571220")
                }catch{}
                return giveaway
            })
            const message_id = message.id
            watchingGiveawayMap.set(message_id, giveaway)
            await giveawayQueue.queueAction(giveaway.channel_id, async () => {
                const giveaway = await Giveaway.findOne({
                    message_id: message_id
                })
                watchingGiveawayMap.set(message_id, giveaway)
                if(!giveaway.bot_message_id)await startGiveaway(giveaway)

                let resolve = () => {}
                const promise = new Promise<void>(r => {
                    resolve = r
                })
                resolveGiveaway.set(message_id, resolve)
                timeoutsGiveway.set(message_id, lt.setTimeout(async () => {
                    // Giveaway should have ended!
                    await endGiveaway(giveaway)
                    .catch(console.error)
                    resolve()
                }, giveaway.creation_date.getTime()+giveaway.duration-Date.now()))
                await promise
                timeoutsGiveway.delete(message_id)
                watchingGiveawayMap.delete(message_id)
                resolveGiveaway.delete(message_id)
            })
        }
    }
}