/* eslint-disable @typescript-eslint/no-unused-vars */

import {Comment, PrivateMessage} from "snoowrap"

export default class Command {
    alias: string[]
    // Command usage where
    // <> is a mandatory argument
    // {} is an optional argument 
    usage: string
    description: string

    async executePublic(item:Comment, args:string[], command:string):Promise<any>{
        throw new CommandError("The command wasn't defined in its file.")
    }

    async executePrivate(item:PrivateMessage, args:string[], command:string):Promise<any>{
        throw new CommandError("The command wasn't defined in its file.")
    }
}

export class CommandError extends Error {
    name = "CommandError"
}