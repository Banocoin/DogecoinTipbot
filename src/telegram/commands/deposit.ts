import { Message } from "node-telegram-bot-api";
import { bot } from "..";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import telegramqueue from "../telegramqueue";
import qrcode from "qrcode"

export default new class DepositCommand implements Command {
    alias = ["deposit"]

    usage = ""

    async execute(message: Message): Promise<any> {
        if(message.chat.type !== "private"){
            await bot.sendMessage(message.chat.id, "Please execute this command in DMs.", {
                reply_to_message_id: message.message_id
            })
            return
        }
        const address = await telegramqueue.queueAction(message.from.id, async () => {
            return getVITEAddressOrCreateOne(String(message.from.id), "Telegram")
        })
        await bot.sendMessage(message.chat.id, address.address)
        const data = `vite:${address.address}`
        const buffer = await new Promise<Buffer>((resolve, reject) => {
            qrcode.toBuffer(data, (error, buffer) => {
                if(error)return reject(error)
                resolve(buffer)
            })
        })
        await bot.sendPhoto(message.chat.id, buffer)
    }
}