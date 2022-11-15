import { Message } from "discord.js";
import { defaultEmoji } from "../../common/constants";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import discordqueue from "../discordqueue";
import { throwFrozenAccountError } from "../util";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";

export default new class ReceiveCommand implements Command {
    description = "Receive stuck txs"
    extended_description = `If you have stuck txs, this command can be handy to unlock your money.`

    alias = ["receive"]
    usage = ""

    async execute(message:Message, args: string[], command: string){
        const address = await discordqueue.queueAction(message.author.id, async () => {
            return getVITEAddressOrCreateOne(message.author.id, "Discord")
        })

        if(address.paused){
            await throwFrozenAccountError(message, args, command)
        }

        await viteQueue.queueAction(address.address, async () => {
            try{
                await message.react(defaultEmoji)
            }catch{}
            await requestWallet("process_account", address.address)
            await message.react("909408282307866654")
        })
    }
}