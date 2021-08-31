import BigNumber from "bignumber.js"
import { tokenIds } from "./constants"

export function tokenIdToName(tokenId:string){
    const entries = Object.entries(tokenIds)
    return entries.find(e => e[1] === tokenId)?.[0]
}

export function convert(amount: string|BigNumber|number, base_unit: string, unit: string){
    let value = new BigNumber(amount)
    switch(base_unit){
        case "ETH":
        case "VITC": 
        case "VX":
        case "VITE":
            value = value.shiftedBy(18)
        break
        case "BAN":
            value = value.shiftedBy(29)
        break
        case "NANO":
            value = value.shiftedBy(30)
        break
        case "BTC":
            value = value.shiftedBy(8)
        break
        case "XMR":
            value = value.shiftedBy(12)
        break
    }
    switch(unit){
        case "ETH":
        case "VITC": 
        case "VX":
        case "VITE":
            value = value.shiftedBy(-18)
        break
        case "BAN":
            value = value.shiftedBy(-29)
        break
        case "NANO":
            value = value.shiftedBy(-30)
        break
        case "BTC":
            value = value.shiftedBy(-8)
        break
        case "XMR":
            value = value.shiftedBy(-12)
        break
    }
    const toFixed = value.toFixed()
    return toFixed
}

export function tokenNameToDisplayName(token: string){
    token = tokenIdToName(token) || token
    switch(token){
        case "VITC": 
            return "Vitamin Coin 💊"
        case "BAN":
            return "Banano 🍌"
        case "NANO":
            return "Nano"
        case "VITE":
            return "Vite"
    }
    return token
}