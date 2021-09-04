import { Message } from "discord.js";
import { tokenIds } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getBalances, getVITEAddressOrCreateOne, sendVITE } from "../../cryptocurrencies/vite";
import viteQueue from "../../cryptocurrencies/viteQueue";
import Giveaway from "../../models/Giveaway";
import GiveawayEntry from "../../models/GiveawayEntry";
import Command from "../command";
import discordqueue from "../discordqueue";
import BigNumber from "bignumber.js"
import Tip from "../../models/Tip";
import rain from "./rain";
import help from "./help";

export default new class DonateCommand implements Command {
    description = "Add vitc/any token to the current giveaway pot."
    extended_description = `Donate to the current giveaway pot. 

**Donate 10 ${tokenNameToDisplayName("VITC")}**
${process.env.DISCORD_PREFIX}do 10 vite
**Donate 10 ${tokenNameToDisplayName("VITC")}**
${process.env.DISCORD_PREFIX}do 10`
    alias = ["donate", "do"]
    usage = "<amount> {currency}"

    async execute(message:Message, args:string[], command:string){
        if(!message.guildId || !rain.allowedGuilds.includes(message.guildId)){
            try{
                await message.react("❌")
            }catch{}
            return
        }
        const [
            amountRaw,
            currencyRaw
        ] = args
        let currency = "vitc"
        if(!amountRaw || !/^\d+(\.\d+)?$/.test(amountRaw))return help.execute(message, [command])
        const amount = new BigNumber(amountRaw)
        if(currencyRaw)currency = currencyRaw
        currency = currency.toUpperCase()
        if(!Object.keys(tokenIds).includes(currency)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`The token ${currency} isn't supported. Use the command ${process.env.DISCORD_PREFIX}lstokens to see a list of supported tokens.`)
            return
        }
        try{
            await message.react("💊")
        }catch{}
        const giveaway = await Giveaway.findOne()
        if(!giveaway){
            try{
                await message.react("❌")
                await message.author.send(`No giveaways were found.`)
            }catch{}
            return
        }

        // send money to the centralized giveaway account
        const [
            address,
            giveawayLockAccount
        ] = await Promise.all([
            discordqueue.queueAction(message.author.id, async () => {
                return getVITEAddressOrCreateOne(message.author.id, "Discord")
            }),
            discordqueue.queueAction(giveaway.user_id, async () => {
                return getVITEAddressOrCreateOne(giveaway.message_id, "Discord.Giveaway")
            })
        ])

        await viteQueue.queueAction(address.address, async () => {
            const amountRaw = convert(amount, currency, "RAW").split(".")[0]
            if(amountRaw == "0"){
                try{
                    await message.react("❌")
                    await message.author.send(`You can't donate 0 ${tokenNameToDisplayName(currency)}.`)
                }catch{}
            }
            const balances = await getBalances(address.address)
            const balance = new BigNumber(balances[tokenIds[currency]] || 0)
            if(balance.isLessThan(amountRaw)){
                try{
                    await message.react("❌")
                    await message.author.send(
                        `You need ${amount.toFixed()} VITC to enter this giveaway but you only have ${convert(balance, "RAW", currency)} ${tokenNameToDisplayName(currency)} in your balance. Use .deposit to top up your account.`
                    )
                }catch{}
                return
            }
            const hash = await sendVITE(
                address.seed,
                giveawayLockAccount.address,
                amountRaw,
                tokenIds[currency]
            )
            if(currency === "VITC"){
                await Tip.create({
                    amount: parseFloat(amount.toFixed()),
                    user_id: message.author.id,
                    date: new Date(),
                    txhash: hash
                })
            }
            try{
                await message.react("873558842699571220")
                await message.author.send(`Thanks for donating to the prize pool!`)
            }catch{}
        })
    }
}