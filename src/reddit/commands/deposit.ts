import { Comment, PrivateMessage } from "snoowrap";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import redditqueue from "../redditqueue";
import * as qrcode from "qrcode"
import { uploadImage } from "../../common/image_upload";

export default new class DepositCommand implements Command {
    alias = ["deposit"]
    usage = "";
    description = "Display your deposit address";
    async executePublic(item: Comment): Promise<any> {
        await item.reply("Please execute this command in DMs.")
            .then(() => {})
    }
    async executePrivate(item: PrivateMessage): Promise<any> {
        const id = await item.author.id
        const address = await redditqueue.queueAction(id, async () => {
            return await getVITEAddressOrCreateOne(id, "Reddit")
        })
        // just assume that it's on the vite network
        const data = `vite:${address.address}`
        const buffer = await new Promise<Buffer>((resolve, reject) => {
            qrcode.toBuffer(data, (error, buffer) => {
                if(error)return reject(error)
                resolve(buffer)
            })
        })
        let link = "Error: Couldn't upload qrcode of deposit address."
        try{
            link = await uploadImage(buffer)
        }catch{}
        
        await item.reply(`Your deposit address is \`${address.address}\` 

QR code: ${link}`).then(()=>{})
    }
    
}