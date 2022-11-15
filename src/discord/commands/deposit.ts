import { Message } from "discord.js";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import { generateDefaultEmbed } from "../util";
import * as qrcode from "qrcode"
import { tokenIds, tokenTickers } from "../../common/constants";
import { requestWallet } from "../../libwallet/http";
import { getDepositInfo, getMetaInfo } from "../../common/vitex-gateway";
import { convert } from "../../common/convert";

export default new class DepositCommand implements Command {
    description = "Get your deposit address"
    extended_description = "Retrieve your deposit address."
    alias = ["deposit"]
    usage = "{currency} {network}"

    async execute(message:Message, args:string[]){
        const address = await discordqueue.queueAction(message.author.id, async () => {
            return await getVITEAddressOrCreateOne(message.author.id, "Discord")
        })
        const [
            currency,
            network
        ] = args
        if(!currency){
            // just assume that it's on the vite network
            const data = `vite:${address.address}`
            const buffer = await new Promise<Buffer>((resolve, reject) => {
                qrcode.toBuffer(data, (error, buffer) => {
                    if(error)return reject(error)
                    resolve(buffer)
                })
            })
            const embed = generateDefaultEmbed()
            .setImage("attachment://qrcode.png")
            .setAuthor("Your deposit address")
            await message.author.send({
                content: address.address,
                embeds: [embed],
                files: [{
                    attachment: buffer,
                    name: "qrcode.png"
                }]
            })
            if(message.guild){
                await message.channel.send("I've sent your deposit address in your DM!")
            }
        }else{
            const tokenId = tokenIds[currency.toUpperCase()]
            if(!tokenId){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send({
                    content: `Unknown currency: ${currency}.`,
                    reply: {
                        messageReference: message,
                        failIfNotExists: false
                    }
                })
                return
            }
            const gateways = await requestWallet("get_gateways")
            const gateway = gateways[tokenId]
            if(!gateway){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send({
                    content: `No cross-chain deposit found for this token.`,
                    reply: {
                        messageReference: message,
                        failIfNotExists: false
                    }
                })
                return
            }
            let token = gateway.tokens[tokenId]
            if(token.extraStandards?.length){
                if(!network){
                    try{
                        await message.react("❌")
                    }catch{}
                    await message.author.send({
                        content: `Please choose a network: ${
                            tokenTickers[tokenId]
                        }, ${
                            token.extraStandards.map(e => e.mappedNet)
                        }`,
                        reply: {
                            messageReference: message,
                            failIfNotExists: false
                        }
                    })
                    return
                }else{
                    const tkn = token.extraStandards.find(e => e.mappedNet === network.toUpperCase())
                    if(tkn){
                        token = tkn
                    }else if(tokenTickers[tokenId] !== network.toUpperCase()){
                        try{
                            await message.react("❌")
                        }catch{}
                        await message.author.send({
                            content: `Invalid network: ${network}, please choose one of the following: ${
                                tokenTickers[tokenId]
                            }, ${
                                token.extraStandards.map(e => e.mappedNet)
                            }`,
                            reply: {
                                messageReference: message,
                                failIfNotExists: false
                            }
                        })
                        return
                    }
                }
            }
            
            // we have the token on the corresponding network
            const metaInfo = await getMetaInfo(token.url, tokenId)
            if(metaInfo.data.depositState !== "OPEN"){
                try{
                    await message.react("❌")
                }catch{}
                await message.author.send({
                    content: `Deposits for this token are halted. Please contact ${gateway.name} (${gateway.support}) for more informations.`,
                    reply: {
                        messageReference: message,
                        failIfNotExists: false
                    }
                })
                return
            }

            const depositInfo = await getDepositInfo(token.url, tokenId, address.address)
            const buffer = await new Promise<Buffer>((resolve, reject) => {
                qrcode.toBuffer(depositInfo.data.depositAddress, (error, buffer) => {
                    if(error)return reject(error)
                    resolve(buffer)
                })
            })
            const name = `${tokenTickers[tokenId]} (${token.mappedNet})`
            const embed = generateDefaultEmbed()
            .setImage("attachment://qrcode.png")
            .setDescription(`> You can only deposit **${
                name
            }** through the address provided above. No less than **${
                convert(depositInfo.data.minimumDepositAmount, "RAW", tokenTickers[tokenId])
            } ${
                name
            }** will be accepted.

> The account will update after **${depositInfo.data.confirmationCount} network confirmations**. Please wait.

> Please select the correct mainnet or you will be unable to retrieve any lost tokens.

> This service is provided by **${gateway.name}** (${gateway.support}). In no event shall VitaBot or its authors be responsible for any lost, misdirected or stolen funds`)
            .setAuthor("Your deposit address")
            await message.author.send({
                content: `Address: ${depositInfo.data.depositAddress}\n${depositInfo.data.labelName || "Memo"}: ${depositInfo.data.label}`,
                embeds: [embed],
                files: [{
                    attachment: buffer,
                    name: "qrcode.png"
                }]
            })
            if(message.guild){
                await message.channel.send("I've sent your deposit address in your DM!")
            }
        }
    }
}