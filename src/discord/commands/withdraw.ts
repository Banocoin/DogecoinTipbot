import { Message, MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import { defaultEmoji, tokenDecimals, tokenIds, tokenTickers } from "../../common/constants";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import { generateDefaultEmbed, throwBlacklistedAddressError, throwFrozenAccountError } from "../util";
import help from "./help";
import BigNumber from "bignumber.js"
import viteQueue from "../../cryptocurrencies/viteQueue";
import * as vite from "@vite/vitejs"
import { requestWallet } from "../../libwallet/http";
import ExternalAddressBlacklist from "../../models/ExternalAddressBlacklist";
import { parseAmount } from "../../common/amounts";
import ActionQueue from "../../common/queue";
import { tokenPrices } from "../../common/price";
import fetch from "node-fetch";
import { SendTransaction } from "../../wallet/events";

export default new class WithdrawCommand implements Command {
    description = "Withdraw the funds on the tipbot"
    extended_description = `Withdraw your money to a personal wallet.

Examples:
**Withdraw all your ${tokenNameToDisplayName("VITC")} to your wallet**
.withdraw all vite_addr
**Withdraw 1 ${tokenNameToDisplayName("VITC")} to your wallet**
.Withdraw 1 vite_addr
**Withdraw all your ${tokenNameToDisplayName("BAN")} to your wallet**
.withdraw all BAN vite_addr
**Withdraw 1 ${tokenNameToDisplayName("BAN")} to your wallet**
.Withdraw 1 BAN vite_addr`

    alias = ["withdraw", "send"]
    usage = "<amount|all> {currency} <vite_addr>"

    async execute(message:Message, args: string[], command: string){
        if(message.guild){
            await message.reply("Please execute this command in DMs")
            return
        }
        if(args.length === 0){
            return this.execute_menu(message)
        }
        let [
            // eslint-disable-next-line prefer-const
            amountRaw,
            currencyOrRecipient,
            addr
        ] = args
        if(!amountRaw || !currencyOrRecipient)return help.execute(message, [command])
        if(!/^\d+(\.\d+)?$/.test(amountRaw) && amountRaw !== "all")return help.execute(message, [command])
        if(vite.wallet.isValidAddress(currencyOrRecipient)){
            // user here
            addr = currencyOrRecipient
            currencyOrRecipient = "vitc"
        }
        let isRawTokenId = false
        currencyOrRecipient = currencyOrRecipient.toUpperCase()

        if(!(currencyOrRecipient in tokenIds)){
            if(vite.utils.isValidTokenId(currencyOrRecipient.toLowerCase())){
                isRawTokenId = true
                currencyOrRecipient = currencyOrRecipient.toLowerCase()
            }else{
                try{
                    await message.react("❌")
                }catch{}
                await message.reply(`The token **${currencyOrRecipient}** isn't supported.`)
                return
            }
        }
        
        /*
        Allow them to withdraw shit tokens lol
        if((tokenIds[currencyOrRecipient] in disabledTokens)){
            try{
                await message.react("❌")
            }catch{}
            await message.author.send(`The token **${currencyOrRecipient}** is currently disabled, because: ${disabledTokens[tokenIds[currencyOrRecipient]]}`)
            return
        }*/
        if(!addr)return help.execute(message, [command])
        if(!vite.wallet.isValidAddress(addr)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`Invalid withdrawal address. Usage: \`${process.env.DISCORD_PREFIX}${command} ${this.usage}\``)
            return
        }

        const address = await discordqueue.queueAction(message.author.id, async () => {
            return getVITEAddressOrCreateOne(message.author.id, "Discord")
        })
        if(address.paused){
            await throwFrozenAccountError(message, args, command)
        }else{
            const bl = await ExternalAddressBlacklist.findOne({
                address: addr
            })
            if(bl){
                address.paused = true;
                await address.save()
                return throwBlacklistedAddressError(message, args, command)
            }
        }

        await viteQueue.queueAction(address.address, async () => {
            try{
                await message.react(defaultEmoji)
            }catch{}
            const balances = await requestWallet("get_balances", address.address)
            const token = isRawTokenId ? currencyOrRecipient : tokenIds[currencyOrRecipient]
            const balance = new BigNumber(token ? balances[token] || "0" : "0")
            const amount = new BigNumber(amountRaw === "all" ? balance : convert(amountRaw, currencyOrRecipient, "RAW"))
            if(balance.isLessThan(amount)){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send({
                    content: `You don't have enough money to cover this withdraw. You need ${convert(amount, "RAW", currencyOrRecipient)} ${currencyOrRecipient} but you only have ${convert(balance, "RAW", currencyOrRecipient)} ${currencyOrRecipient} in your balance.`,
                    reply: {
                        messageReference: message,
                        failIfNotExists: false
                    }
                })
                return
            }
            if(amount.decimalPlaces(0).isEqualTo(0)){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send({
                    content: `You can't send **0 ${tokenNameToDisplayName(currencyOrRecipient)}**.`,
                    reply: {
                        messageReference: message,
                        failIfNotExists: false
                    }
                })
                return
            }
            const tx = await requestWallet(
                "send",
                address.address, 
                addr, 
                amount.toFixed(0), 
                token
            )
            try{
                await message.react("909408282307866654")
            }catch{}
            await message.channel.send({
                content: `Your withdraw was processed!

View transaction on VITCScan: https://vitcscan.com/tx/${tx.hash}`,
                reply: {
                    messageReference: message,
                    failIfNotExists: false
                }
            })
        })
    }

    generateEmbed(){
        return generateDefaultEmbed()
        .setTitle("Withdrawal")
    }

    async execute_menu(message: Message){
        let embed = this.generateEmbed()
        .setDescription(`This menu will guide you through making a withdrawal. Please reply with the **amount to withdraw**.
        
Example: \`10 vitc\`
To withdraw all vitc: \`all vitc\``)
        .setFooter({
            text: `Reply with "abort" to abort this withdrawal`
        })
        const cancelEmbed = new MessageEmbed(embed)
        .setDescription(`This withdrawal request was cancelled.`)
        const timeoutEmbed = new MessageEmbed(embed)
        .setDescription(`This withdrawal request has timed out.`)

        const msg = await message.reply({
            embeds: [embed]
        })

        let state:"pending"|"received"|"cancel" = "pending"
        const collector = message.channel.createMessageCollector({
            time: 60000
        })
        
        collector.on("end", () => {
            switch(state){
                case "pending":
                    embed = timeoutEmbed
                    break
                case "received":
                    return
                case "cancel":
                    embed = cancelEmbed
            }
            msg.edit({
                embeds: [embed]
            }).catch(()=>{})
        })
        collector.on("collect", async usrmsg => {
            if(usrmsg.author.id !== message.author.id)return
            if(state !== "pending")return
            if(usrmsg.content === "abort"){
                state = "cancel"
                collector.stop()
                try{
                    await usrmsg.react("909408282307866654")
                }catch{}
                return
            }
            if(usrmsg.content.startsWith(process.env.DISCORD_PREFIX))return

            const args = usrmsg.content.split(/ +/g)
            if(args.length !== 2)return
            const amountRaw = args[0]
            let currency = args[1].toUpperCase()

            let token = tokenIds[currency]
            if(!(currency in tokenIds)){
                if(vite.utils.isValidTokenId(currency.toLowerCase())){
                    currency = currency.toLowerCase()
                    token = currency
                    if(tokenTickers[currency]){
                        currency = tokenTickers[currency]
                    }
                }else{
                    try{
                        await usrmsg.react("❌")
                    }catch{}
                    await usrmsg.reply(`The token **${currency}** isn't supported. Please try again.`)
                    return
                }
            }
            let amount:BigNumber
            try{
                if(amountRaw !== "all"){
                    amount = parseAmount(amountRaw, token)
                }
            }catch{
                try{
                    await usrmsg.react("❌")
                }catch{}
                await usrmsg.reply(`Coulnd't parse the amount in your message. Please try again.`)
                return
            }
            state = "received"
            collector.stop()
            
            const address = await discordqueue.queueAction(usrmsg.author.id, () => {
                return getVITEAddressOrCreateOne(usrmsg.author.id, "Discord")
            })

            await viteQueue.queueAction(address.address, async () => {
                const balances = await requestWallet("get_balances", address.address)
                const balance = new BigNumber(balances[token] || "0")
                const amountraw = amount ? amount.shiftedBy(tokenDecimals[currency] || 0).decimalPlaces(0) : balance
                const displayAmount = convert(amountraw, "RAW", currency)

                if(amountraw.isGreaterThan(balance)){
                    try{
                        await message.react("❌")
                    }catch{}
                    await message.author.send({
                        content: `You don't have enough money to cover this withdraw. You need ${convert(amountraw, "RAW", currency)} ${currency} but you only have ${convert(balance, "RAW", currency)} ${currency} in your balance.`,
                        reply: {
                            messageReference: message,
                            failIfNotExists: false
                        }
                    })

                    msg.edit({
                        embeds: [cancelEmbed]
                    }).catch(()=>{})
                    return
                }

                embed.setDescription("Amount valid. Please continue this withdrawal request with the new bot message.")
                msg.edit({
                    embeds: [embed]
                }).catch(()=>{})

                embed.setDescription(`Amount: **${displayAmount} ${currency}**
        
Please reply with the recipient of this withdrawal.
Example: \`vite_b7fe8...fc99d\`
To withdraw to a ViteNS name: \`{name}.vite\``)
                const msg2 = await usrmsg.reply({
                    embeds: [embed]
                })

                const vitensQueue = new ActionQueue()
                let state:"pending"|"received"|"cancel" = "pending"
                const collector = message.channel.createMessageCollector({
                    time: 60000
                })
                collector.on("end", () => {
                    switch(state){
                        case "pending":
                            embed = timeoutEmbed
                            break
                        case "received":
                            return
                        case "cancel":
                            embed = cancelEmbed
                    }
                    msg2.edit({
                        embeds: [embed]
                    }).catch(()=>{})
                    msg.edit({
                        embeds: [embed]
                    }).catch(()=>{})
                })
                collector.on("collect", async usrmsg => {
                    if(usrmsg.author.id !== message.author.id)return
                    if(state !== "pending")return
                    if(usrmsg.content === "abort"){
                        state = "cancel"
                        collector.stop()
                        try{
                            await usrmsg.react("909408282307866654")
                        }catch{}
                        return
                    }
                    if(usrmsg.content.startsWith(process.env.DISCORD_PREFIX))return

                    let recipient = null
                    await vitensQueue.queueAction("", async () => {
                        if(state !== "pending")return
                        if(vite.wallet.isValidAddress(usrmsg.content.toLowerCase())){
                            recipient = usrmsg.content.toLowerCase()
                        }else if(usrmsg.content.endsWith(".vite")){
                            // vitens
                            const name = usrmsg.content.slice(0, -".vite".length)
                            try{
                                recipient = await requestWallet("resolve_vitens", name)
                            }catch(e){
                                console.error(e)
                                try{
                                    await usrmsg.react("❌")
                                }catch{}
                                await usrmsg.reply(`Invalid ViteNS name: ${e.message} Please try again.`)
                            }
                        }else{
                            try{
                                await usrmsg.react("❌")
                            }catch{}
                            await usrmsg.reply(`Invalid Address or vitens name. Please try again`)
                        }
                        if(recipient)state = "received"
                    })

                    if(!recipient)return
                    collector.stop()

                    embed.setDescription("Address valid. Please continue this withdrawal request with the new bot message.")
                    msg2.edit({
                        embeds: [embed]
                    }).catch(()=>{})

                    if(recipient.paused){
                        try{
                            await throwFrozenAccountError(message, [
                                displayAmount,
                                currency,
                                recipient
                            ], "withdraw")
                        }catch(err){
                            try{
                                await usrmsg.react("❌")
                            }catch{}
                            await usrmsg.reply(`${err.name}: ${err.message}`)
                            return
                        }
                    }
                    
                    let addressTag = ""
                    try{
                        const res = await fetch(
                            "https://vite-api.thomiz.dev/names/resolve/"+recipient
                        )
                        const json = await res.json()
                        if(json.name){
                            addressTag = ` (**${json.name}**)`
                        }
                    }catch(e){
                        console.error(e)
                    }
                    let transferType = "Transfer"
                    switch(recipient){
                        case "vite_000000000000000000000000000000000000000595292d996d":
                        case "vite_0000000000000000000000000000000000000000a4f3a0cb58":
                            transferType = "Burn"
                            break
                        default:
                            if(vite.wallet.isValidAddress(recipient) === vite.wallet.AddressType.Contract){
                                transferType = "Contract Interaction"
                            }
                    }
                    const pair = tokenPrices[token+"/"+tokenIds.USDT]
                    const value = !pair ? "" : ` (= **$${
                        new BigNumber(pair.closePrice)
                        .times(displayAmount)
                        .decimalPlaces(2)
                        .toFixed(2)
                    }**)`

                    embed.setDescription(`Type: **${transferType}**
Amount: **${displayAmount} ${currency}**${value}
Recipient: **${recipient}**${addressTag}
        
Is this information correct ?`)
                    .setFooter(null)
                    const msg3 = await usrmsg.reply({
                        embeds: [embed],
                        components: [
                            new MessageActionRow()
                            .addComponents(
                                new MessageButton()
                                    .setCustomId("cancel")
                                    .setLabel("Cancel")
                                    .setStyle("SECONDARY")
                                    .setEmoji("❌"),
                                new MessageButton()
                                    .setCustomId("proceed")
                                    .setLabel("Proceed")
                                    .setStyle("SUCCESS")
                                    .setEmoji("✅")
                            )
                        ]
                    })

                    let state3:"pending"|"received"|"cancel" = "pending"
                    const collector_btn = msg3.createMessageComponentCollector({
                        time: 30000
                    })
                    collector_btn.on("end", (collected) => {
                        if(!collected.find(e => e.user.id === message.author.id)){
                            switch(state3){
                                case "pending":
                                    embed = timeoutEmbed
                                    break
                                case "received":
                                    return
                                case "cancel":
                                    embed = cancelEmbed
                            }
                            msg2.edit({
                                embeds: [embed]
                            }).catch(()=>{})
                            msg.edit({
                                embeds: [embed]
                            }).catch(()=>{})
                            msg3.edit({
                                embeds: [embed]
                            }).catch(()=>{})
                        }
                    })
            
                    collector_btn.on("collect", async interaction => {
                        if(interaction.user.id !== message.author.id){
                            await interaction.reply({
                                ephemeral: true,
                                content: `You are not allowed to interact with this swap request.`
                            })
                            return
                        }
                        if(state3 !== "pending")return

                        switch(interaction.customId){
                            case "proceed": {
                                state3 = "received"
                                await interaction.deferReply()
                                embed.setDescription("Processing...")
                                
                                let tx:SendTransaction
                                try{
                                    tx = await requestWallet(
                                        "send",
                                        address.address, 
                                        recipient, 
                                        amountraw.toFixed(0), 
                                        token
                                    )
                                }catch(err){
                                    console.error(`Error during withdrawal`, err)
                                    if(!(err instanceof Error) && "error" in err){
                                        // eslint-disable-next-line no-ex-assign
                                        err = JSON.stringify(err.error, null, "    ")
                                    }
                                    await interaction.editReply({
                                        content: `An error occured during this withdrawal! Your funds were likely not sent. ` + "```\n"+err+"```"
                                    })
                                    return
                                }

                                embed.setDescription(`Withdrawal Sent!
                                
Type: **${transferType}**
Amount: **${displayAmount} ${currency}**${value}
Recipient: **${recipient}**${addressTag}
Transaction Hash: **[${tx.hash}](https://vitcscan.com/tx/${tx.hash})**`)
                                interaction.editReply({
                                    embeds: [embed]
                                })
                                break
                            }
                            default:
                                state3 = "cancel"
                                collector.stop()
                                interaction.reply({
                                    content: `Withdrawal cancelled.`
                                })
                                return
                        }
                    })
                })
            })
        })
    }
}