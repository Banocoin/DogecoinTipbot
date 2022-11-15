// Resolve a ViteNS name

import { resolveViteNS } from "../vitens"

export default async function resolveName(name:string){
    if(/[^abcdefghijklmnopqrstuvwxyz0123456789_]/.test(name)){
        throw new Error("Invalid ViteNS name")
    }
    return resolveViteNS(name)
}