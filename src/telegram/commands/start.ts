import { Message } from "node-telegram-bot-api";
import { bot } from "..";
import Command from "../command";
import deposit from "./deposit";

export default new class StartCommand implements Command {
    alias = ["start", "tos"]

    usage = ""

    async execute(message: Message, args:string[], command:string): Promise<any> {
        if(message.chat.type !== "private"){
            await bot.sendMessage(message.chat.id, "Please execute this command in DMs.", {
                reply_to_message_id: message.message_id
            })
            return
        }
        await bot.sendMessage(message.chat.id, `${command === "start" ? `Hi, Welcome to VitaBot!
        
This bot is used to tip any token on the *$VITE network*, a feeless and instant cryptocurrency with smart contracts!

` : ""}*📝 Terms and conditions*
    
*VitaBot is beta software*
In no event shall VitaBot or its authors be responsible for any lost, misdirected or stolen funds

*Tips are non-reversible and non-refundable.*
Tips are transactions on the blockchain, they cannot be reversed and will not be refunded. Please check twice before making any tips.

*VitaBot's security*
Your balance's security is as safe as your Telegram account is. Use features like two-factor authentication to keep your account secure. In regards to VitaBot's security – we hold up to industry standards. Your wallet is powered by our tested and proven technology. In case of concerns, please dm @aThomized.

*Privacy disclaimer*
We reserve the right to create an invite and join any server the bot is in, if suspicious activity on it is detected.

*Abuse*
If you are found abusing any systems in the Vitamin Coin server or any other server, your funds will be frozen and seized. We reserve the right to freeze suspicious accounts as well, until proven innocent.

*Always keep small sums of money only*
Even if we keep up with industry standards in terms of security practices, we ask you to not keep huge sums on the bot. Please keep them in a non-custodial wallet.

By using the bot, you agree to the terms and conditions above.`, {
            parse_mode: "Markdown"
        })
        if(command !== "start")await deposit.execute(message)
    }
}