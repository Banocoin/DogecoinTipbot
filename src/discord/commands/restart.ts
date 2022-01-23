import { Message } from "discord.js";
import Command from "../command";
import { VITC_ADMINS, VITC_MODS } from "../constants";
import pm2 from "pm2"
import ActionQueue from "../../common/queue";

const pm2Queue = new ActionQueue<string>()
export default new class RestartCommand implements Command {
    description = "Restart the bot"
    extended_description = "No need for a description"
    alias = ["restart"]
    usage = ""
    hidden = true

    async execute(message:Message, args:string[]){
        if(!VITC_ADMINS.includes(message.author.id) && !VITC_MODS.includes(message.author.id)){
            await message.reply("You don't have the permission.")
            return
        }

        await message.reply("Restarting...")
        
        if(!args[0]){
            process.exit(0)
        }else{
            if(!VITC_ADMINS.includes(message.author.id)){
                await message.reply("You don't have the permission to restart other processes.")
                return
            }
            await pm2Queue.queueAction("pm2", async () => {
                await new Promise<void|any>((resolve, reject) => {
                    pm2.connect((err) => {
                        if(err)return reject(err)

                        pm2.list((err, list) => {
                            if(err){
                                pm2.disconnect()
                                reject(err)
                                return
                            }
                            
                            const process = list.find(p => p.name === args[0])
                            if(!process){
                                pm2.disconnect()
                                message.reply("Unknown process name: "+args[0]+". Possible choices are: "+list.map(e => e.name).join(", "))
                                .then(resolve, reject)
                                return
                            }
                            
                            pm2.restart(process.name, (err) => {
                                pm2.disconnect()
                                if(err)return reject(err)
                                
                                message.reply("Restarted "+process.name+".")
                                .then(resolve, reject)
                            })
                        })
                    })
                })
            })
        }
    }
}