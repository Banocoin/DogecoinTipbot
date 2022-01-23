import { Message } from "discord.js";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import { VITC_ADMINS } from "../constants";
import discordqueue from "../discordqueue";
import { parseDiscordUser } from "../util";
import * as vite from "@vite/vitejs"
import viteQueue from "../../cryptocurrencies/viteQueue";
import ExternalAddressBlacklist from "../../models/ExternalAddressBlacklist";
import Address from "../../models/Address";

export default new class UnBlacklistCommand implements Command {
    description = "You shouldn't see this."
    extended_description = `You shouldn't see this.`
    alias = ["unblacklist"]
    usage = "<id>"
    hidden = true

    async execute(message:Message, args: string[]){
        if(!message.guild)return
        if(!VITC_ADMINS.includes(message.author.id))return
        
        const id = args[0]
        if(!id)return message.reply("Argument #1 missing. Please add an id or an address to blacklist.")
        if(vite.wallet.isValidAddress(id)){
            await viteQueue.queueAction(id, async () => {
                const [
                    bl,
                    addr
                ] = await Promise.all([
                    ExternalAddressBlacklist.findOne({
                        address: id
                    }),
                    Address.findOne({
                        address: id
                    })
                ])
                if(addr){
                    if(addr.paused){
                        await message.channel.send(`Unblacklisting handles: ${addr.handles.join(", ")} Address: ${addr.address}`)
                        addr.paused = false
                        await addr.save()
                    }else{
                        return message.reply("This Internal Address is not blacklisted")
                    }
                }else if(!bl){
                    return message.reply("this External Address is not blacklisted.")
                }else if(bl){
                    await bl.delete()
                    await message.channel.send(`Unblacklisted successfully`)
                }
            })
        }else{
            const user = (await parseDiscordUser(id))[0] 
            if(!user){
                await message.reply("Invalid User.")
                return
            }
            await discordqueue.queueAction(user.id, async () => {
                const address = await getVITEAddressOrCreateOne(user.id, "Discord")
                await message.channel.send(`Unblacklisting User: ${user.tag} Address: ${address.address}`)
                if(!address.paused){
                    await message.channel.send("That user is not blacklisted.")
                    return
                }
                address.paused = false
                await address.save()
                await message.channel.send(`Unblacklisted successfully`)
            })
        }
    }
}