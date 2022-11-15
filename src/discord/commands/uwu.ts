import { Message } from "discord.js";
import Command from "../command";
import { BOT_OWNER, VITC_ADMINS, VITC_INSPECTORS, VITC_MODS } from "../constants";
import { generateDefaultEmbed, ID_PATTERN, USER_PATTERN } from "../util";
import help from "./help";
import * as vite from "@vite/vitejs"
import { client } from "..";
import { getVITEAddress } from "../../wallet/address";
import Address from "../../models/Address";
import discordqueue from "../discordqueue";
import { defaultEmoji } from "../../common/constants";
import fetch from "node-fetch"

export default new class UwUCommand implements Command {
    description = "Get an user's address from his discord account"
    extended_description = `Get an user's address from his discord account.
    
Example:
.uwu <@${BOT_OWNER}>`
    alias = ["uwu"]
    usage = "<id>"
    hidden = true

    async execute(message:Message, args: string[], command: string){
        if(
            !(message.guild && message.member.permissions.has("KICK_MEMBERS")) &&
            !VITC_ADMINS.includes(message.author.id) && 
            message.author.id !== "961732366055915530" && 
            message.author.id !== "998322300480917656" &&
            !VITC_MODS.includes(message.author.id) &&
            !VITC_INSPECTORS.includes(message.author.id)
        )return
        
        await message.react(defaultEmoji).catch(()=>{})
        if(!args[0]){
            await message.react("❌").catch(()=>{})
            await help.execute(message, [command])
            return
        }
        for(const arg of args){
            let rawAddress:string = null
            if(vite.wallet.isValidAddress(arg)){
                const address = await Address.findOne({
                    address: arg
                })
                if(address){
                    rawAddress = arg
                }
            }else if(ID_PATTERN.test(arg)){
                // user id
                const user = await client.users.fetch(arg).catch(()=>{})
                if(user){
                    const address = await discordqueue.queueAction(user.id, () => {
                        return getVITEAddress(user.id, "Discord").catch(()=>{})
                    })
                    if(address){
                        rawAddress = address.address
                    }
                }
            }else if(USER_PATTERN.test(arg)){
                // user mention
                const parsed = arg.match(USER_PATTERN)
                const user = await client.users.fetch(parsed.groups.id).catch(()=>{})
                if(user){
                    const address = await discordqueue.queueAction(user.id, () => {
                        return getVITEAddress(user.id, "Discord").catch(()=>{})
                    })
                    if(address){
                        rawAddress = address.address
                    }
                }
            }
            if(!rawAddress){
                await message.react("❌").catch(()=>{})
                await message.reply(`> ${arg}\nEither that address is invalid, either that address isn't from the tipbot, either that user is invalid, either that user doesn't have an address registered at the tipbot.`)
                continue
            }

            const address = await Address.findOne({
                address: rawAddress
            })
    
            const res = await fetch("https://vitamin.tips/api/address/lookup", {
                method: "post",
                body: JSON.stringify([
                    address.address
                ]),
                headers: {
                    "Content-Type": "application/json"
                }
            })
            const json = await res.json()
    
            const embed = generateDefaultEmbed()
            .setDescription(`**Address**
\`\`\`${address.address}\`\`\`
**Address Handles**
\`\`\`${address.handles.join("\n")}\`\`\`
**Name Tag**
\`\`\`${json[address.address] || "Unknown Name Tag"}\`\`\`
[Link to VITCScan](https://vitcscan.com/address/${address.address})`)
    
            await message.reply({
                embeds: [embed],
                content: address.address
            })
        }

        await message.react("909408282307866654").catch(()=>{})
    }
}