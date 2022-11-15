import { Message } from "node-telegram-bot-api";
import { bot } from ".";

export const AddressFrozenError = async (message:Message, args:string[], command:string) => {
    const bltext = `An action was requested, but was blocked because account is frozen.
        
@${message.from.username} (${message.from.id}): ${command} ${JSON.stringify(args)}`
    await Promise.all([
        bot.sendMessage(
            message.chat.id,
            "Your account has been frozen, likely for using alts or abusing a faucet/rains. Please contact @aThomized to unlock your account.",
            {
                reply_to_message_id: message.message_id
            }
        ),
        bot.sendMessage(
            "aThomized",
            bltext
        ).catch(() => {
            console.error(`Couldn't alert aThomized about a blacklist`)
            console.error(bltext)
        })
    ])
}
export const AddressBlacklistedError = async (message:Message, args:string[], command:string) => {
    const bltext = `Please review this new blacklist.
    
An action was requested, but was blocked because withdraw address is blacklisted.
        
@${message.from.username} (${message.from.id}): ${command} ${JSON.stringify(args)}`    
    await Promise.all([
        bot.sendMessage(
            message.chat.id,
            "Your account has been frozen, for withdrawing to a blacklisted address. Please contact @aThomized to unlock your account.",
            {
                reply_to_message_id: message.message_id
            }
        ),
        bot.sendMessage(
            "aThomized",
            bltext
        ).catch(() => {
            console.error(`Couldn't alert aThomized about a blacklist`)
            console.error(bltext)
        })
    ])
}