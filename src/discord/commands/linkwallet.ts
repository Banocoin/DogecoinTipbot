import { Message } from "discord.js";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import * as crypto from "crypto";
import WalletLinkingSecret from "../../models/WalletLinkingSecret";
import * as qrcode from "qrcode";
import { generateDefaultEmbed } from "../util";

export default new class LinkWalletCommand implements Command {
    description = "Link your external wallet to your bot account"
    extended_description = `Link your external wallet to your bot account`

    alias = ["linkwallet"]
    usage = ""

    hidden = true

    async execute(message:Message){
        if(message.guild){
            await message.reply("Please execute this command in DMs")
            return
        }
        await discordqueue.queueAction(message.author.id, async () => {
            const address = await getVITEAddressOrCreateOne(message.author.id, "Discord.Link")
            let secret = await WalletLinkingSecret.findOne({
                address: address
            })
            if(!secret){
                secret = await WalletLinkingSecret.create({
                    address: address,
                    secret: crypto.randomBytes(64).toString("hex")
                })
            }
            
            // just assume that it's on the vite network
            const data = `vite:${address.address}?data=${
                Buffer.from(secret.secret, "hex")
                .toString("base64")
                .replace(/\++/g, "-")
                .replace(/\/+/g, "_")
                .replace(/=+/g, "")
            }&amount=0`
            const buffer = await new Promise<Buffer>((resolve, reject) => {
                qrcode.toBuffer(data, (error, buffer) => {
                    if(error)return reject(error)
                    resolve(buffer)
                })
            })
            const embed = generateDefaultEmbed()
            .setImage("attachment://qrcode.png")
            .setAuthor("Execute this transaction to link your wallet.")
            await message.author.send({
                content: `***Link your wallet***
Execute this transaction in Vite Wallet. The address who is sending the transaction will be linked to VitaBot.

**THIS TRANSACTION WILL NOT SEND MONEY**`,
                embeds: [embed],
                files: [{
                    attachment: buffer,
                    name: "qrcode.png"
                }]
            })
        })
    }
}