import { bot } from "."
import { durationUnits } from "../common/util"
import ActiveStats from "../models/ActiveStatsTelegram"
import ActiveStatus from "../models/ActiveStatusTelegram"
import ActiviaFreeze from "../models/ActiviaFreezeTelegram"
import activeQueue from "./activeQueue"

bot.on("message", async message => {
    if((message.chat.type !== "group" && message.chat.type !== "supergroup") || message.from.is_bot)return
    if(!message.text || message.text.startsWith("/"))return
    const content = message.text
    if(!content || content.length < 2)return

    await activeQueue.queueAction(message.from.id, async () => {
        const frozen = await ActiviaFreeze.findOne({
            user_id: message.from.id
        })
        if(frozen)return
        await ActiveStats.create({
            user_id: message.from.id,
            message_id: message.message_id,
            createdAt: new Date(),
            num: 1,
            chat_id: message.chat.id
        })
        const numOfActives = await ActiveStats.countDocuments({
            user_id: message.from.id,
            createdAt: {
                $gt: new Date(Date.now()-durationUnits.m*5)
            },
            chat_id: message.chat.id
        })
        if(numOfActives >= 2){
            const active = await ActiveStatus.findOne({
                user_id: message.from.id,
                chat_id: message.chat.id
            })
            if(active){
                active.createdAt = new Date()
                await active.save()
            }else{
                await ActiveStatus.create({
                    user_id: message.from.id,
                    createdAt: new Date(),
                    chat_id: message.chat.id
                })
            }
        }
    })
})

export async function getActiveUsers(chat_id: number):Promise<number[]>{
    const users = await ActiveStatus.find({
        createdAt: {
            $gt: new Date(Date.now()-durationUnits.m*30)
        },
        chat_id: chat_id
    })
    return users.map(e => e.user_id)
}