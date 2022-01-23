/* eslint-disable @typescript-eslint/no-unused-vars */

import { Message } from "node-telegram-bot-api"

export default class Command {
    alias: string[]
    // Command usage where
    // <> is a mandatory argument
    // {} is an optional argument 
    usage: string

    async execute(message:Message, args:string[], command:string):Promise<any>{
        throw new CommandError("The command wasn't defined in its file.")
    }
}

export class CommandError extends Error {
    name = "CommandError"
}