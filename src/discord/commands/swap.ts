import { Message, MessageActionRow, MessageButton } from "discord.js";
import Command from "../command";
import help from "./help";
import { tokenDecimals, tokenIds } from "../../common/constants";
import { parseAmount } from "../../common/amounts";
import { tokenNameToDisplayName } from "../../common/convert";
import discordqueue from "../discordqueue";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import { requestWallet } from "../../libwallet/http";
import * as vite from "@vite/vitejs"
import BigNumber from "bignumber.js";
import { generateDefaultEmbed, throwFrozenAccountError } from "../util";
import { tokenPrices } from "../../common/price";
import { wait } from "../../common/util";

export default new class SwapCommand implements Command {
    description = "Swap crypto with VITCSwap"
    extended_description = "Swap crypto instantly with https://swap.vitc.org"
    alias = ["swap"]
    usage = "<amount> <from_currency> <to_currency>"

    async execute(message:Message, args:string[], command: string){
        if(message.channel.id === "985661234273742878"){
            try{
                await message.react("❌")
            }catch{}
            const botmsg = await message.reply(`Please use the <#907279844319035406> channel to make swaps.`)
            await wait(5000)
            try{
                await message.delete()
            }catch{}
            try{
                await botmsg.delete()
            }catch{}
            return
        }
        const amount = args[0]
        const [
            currency0,
            currency1
        ] = args.slice(1).map(e => e.toUpperCase())
        if(!amount)return help.execute(message, [command])

        if(!(currency0 in tokenIds)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`The token **${currency0}** isn't supported.`)
            return
        }
        if(!(currency1 in tokenIds)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`The token **${currency1}** isn't supported.`)
            return
        }
        const [
            token0,
            token1
        ] = [
            tokenIds[currency0],
            tokenIds[currency1]
        ]
        if(token0 === token1){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(`The sell and buy currency are the same.`)
            return
        }

        let amountParsed:BigNumber
        const address = await discordqueue.queueAction(message.author.id, async () => {
            return getVITEAddressOrCreateOne(message.author.id, "Discord")
        })

        if(address.paused){
            await throwFrozenAccountError(message, args, command)
        }

        if(amount === "all"){
            const balance = (await requestWallet("get_balances", address.address))[token0] || "0"
            amountParsed = new BigNumber(balance)
            .shiftedBy(-tokenDecimals[currency0])
        }else{
            amountParsed = parseAmount(amount, token0)
        }
        if(amountParsed.isEqualTo(0)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(
                `You can't swap **0 ${tokenNameToDisplayName(currency0)}**.`
            )
            return
        }
        const raw_amount = amountParsed
            .shiftedBy(tokenDecimals[currency0])
            .toFixed(0)

        const pairs = await requestWallet("get_vitcswap_pairs")

        if(token0 !== vite.constant.Vite_TokenId && !pairs.includes(token0)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(
                `The token **${tokenNameToDisplayName(currency0)}** is not listed on VITCSwap.`
            )
            return
        }
        if(token1 !== vite.constant.Vite_TokenId && !pairs.includes(token1)){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(
                `The token **${tokenNameToDisplayName(currency1)}** is not listed on VITCSwap.`
            )
            return
        }

        let estimation:string
        try{
            estimation = await requestWallet(
                "get_vitcswap_conversion",
                raw_amount,
                token0,
                token1
            )
        }catch(err){
            try{
                await message.react("❌")
            }catch{}
            await message.reply(
                `An error occured while trying to simulate trade. There is likely insufficient liquidity.`
            )
            return
        }

        const pair0 = tokenPrices[token0+"/"+tokenIds.USDT]
        const pair1 = tokenPrices[token1+"/"+tokenIds.USDT]
        const embed = generateDefaultEmbed()
        .setDescription(`Click on the :white_check_mark: button to proceed with this swap. You have 30 seconds.`)
        .addField(
            `You Pay`,
            `${
                new BigNumber(raw_amount)
                .shiftedBy(-tokenDecimals[currency0])
                .toFixed()
            } **${
                tokenNameToDisplayName(currency0)
            }** (**$${
                new BigNumber(pair0?.closePrice || 0)
                    .times(raw_amount)
                    .shiftedBy(-tokenDecimals[currency0])
                    .decimalPlaces(2)
                    .toFixed(2)
            }** on Vitex)`,
            true
        )
        .addField(
            `You Receive`,
            `${
                new BigNumber(estimation)
                .shiftedBy(-tokenDecimals[currency1])
                .toFixed()
            } **${
                tokenNameToDisplayName(currency1)
            }** (**$${
                new BigNumber(pair1?.closePrice || 0)
                    .times(estimation)
                    .shiftedBy(-tokenDecimals[currency1])
                    .decimalPlaces(2)
                    .toFixed(2)
            }** on Vitex)`,
            true
        )
        .addField(
            `Slippage Tolerance`,
            `0.5%`
        )
        const row = new MessageActionRow()
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
        const msg = await message.reply({
            embeds: [embed],
            components: [
                row
            ]
        })

        const collector = msg.createMessageComponentCollector({
            time: 30000
        })
        collector.on("end", (collected) => {
            if(!collected.find(e => e.user.id === message.author.id)){
                embed.setDescription(`This swap request has timed out.`)
                msg.edit({
                    embeds: [embed],
                    components: []
                })
            }
        })

        collector.on("collect", async interaction => {
            if(interaction.user.id !== message.author.id){
                await interaction.reply({
                    ephemeral: true,
                    content: `You are not allowed to interact with this swap request.`
                })
                return
            }
            
            if(interaction.customId === "cancel"){
                embed.setDescription(`The user cancelled the swap request.`)
                await msg.edit({
                    embeds: [embed],
                    components: []
                })
                await interaction.reply({
                    ephemeral: true,
                    content: "Cancelled swap request."
                })
            }else{
                embed.setDescription(`Processing...`)
                await msg.edit({
                    embeds: [embed],
                    components: []
                })
                await interaction.deferReply()

                const balances = await requestWallet(
                    "get_balances",
                    address.address
                )

                if(new BigNumber(raw_amount).isGreaterThan(balances[token0] || 0)){
                    embed.setDescription(`Cancelled: Insufficient Balance`)
                    await msg.edit({
                        embeds: [embed],
                        components: []
                    })
                    await interaction.editReply({
                        content: `You do not have enough **${tokenNameToDisplayName(currency0)}** in your balance to complete this swap.`
                    })
                    return
                }

                const tx = await requestWallet(
                    "do_swap_vitcswap",
                    address.address,
                    raw_amount,
                    token0,
                    token1,
                    new BigNumber(estimation)
                        .times(0.995)
                        .toFixed(0),
                    address.address
                )

                const start = Date.now()
                let received = false
                while(start + 100*1000 > Date.now()){
                    await wait(0.5*1000)
                    const block = await requestWallet(
                        "get_account_block",
                        tx.hash
                    )
                    
                    if(!block.receiveBlockHash)continue
                    received = true

                    const receiveBlock = await requestWallet(
                        "get_account_block",
                        block.receiveBlockHash
                    )

                    const data = Buffer.from(
                        receiveBlock.data,
                        "base64"
                    )
                    if(data[32] !== 0){
                        // error
                        await interaction.editReply({
                            content: "This swap request failed: The contract reverted, likely due to insufficient liquidity."
                        })
                    }else{
                        let transferBlock
                        for(const block of (receiveBlock.triggeredSendBlockList || [])){
                            if(block.toAddress !== address.address)continue
                            transferBlock = block
                        }
                        const amount = `**${
                            new BigNumber(transferBlock.amount)
                                .shiftedBy(-tokenDecimals[currency1])
                                .toFixed()
                        } ${tokenNameToDisplayName(currency1)}** (**$${
                            new BigNumber(pair1?.closePrice || 0)
                                .times(transferBlock.amount)
                                .shiftedBy(-tokenDecimals[currency1])
                                .decimalPlaces(2)
                                .toFixed(2)
                        }** on Vitex)`
                        embed.setDescription(`You received ${amount} from VITCSwap.`)
                        await msg.edit({
                            embeds: [embed],
                            components: []
                        })
                        await interaction.editReply({
                            content: `You received ${amount} from VITCSwap.`
                        })

                        // as sometimes, the swap happens
                        // way faster than expected
                        // pow can't follow
                        // so we'll request from wallet
                        // to get the account processed
                        await wait(3000)
                        await requestWallet("process_account", address.address)
                    }
                }
                if(!received){
                    await interaction.editReply({
                        content: "This swap request failed: transaction timed out."
                    })
                }
            }
        })
    }
}