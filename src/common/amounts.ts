import BigNumber from "bignumber.js"
import { tokenIds } from "./constants"
import { tokenPrices } from "./price"

export class InvalidAmountError extends Error {
    name = "InvalidAmountError"
}

export const multipliers = {
    k: 3,
    m: 6,
    b: 9,
    t: 12,
    q: 15
}

export function parseAmount(amount:string, token:string){
    if(!amount)throw new InvalidAmountError("Couldn't parse amount")

    let fiat = null
    if(amount[0] === "$"){
        // dollar equivalent
        fiat = "USDT"
        amount = amount.slice(1)
    }else if(amount.slice(-1) === "$"){
        fiat = "USDT"
        amount = amount.slice(0, -1)
    }

    let multiplier = 0
    if(/[kmbtq]$/.test(amount.toLowerCase())){
        // so, for example, 3k vitc
        const unit = amount.slice(-1)
        amount = amount.slice(0, -1)
        multiplier = multipliers[unit.toLowerCase()]
    }
    
    if(amount.startsWith("."))amount = "0" + amount
    if(!/^\d+(\.\d+)?$/.test(amount))throw new InvalidAmountError("Couldn't parse amount")
    let amountParsed = new BigNumber(amount)

    if(multiplier !== 0){
        amountParsed = amountParsed.shiftedBy(multiplier)
    }
    if(fiat && token !== tokenIds[fiat]){
        const pair = tokenPrices[token+"/"+tokenIds[fiat]]
        if(!pair)throw new InvalidAmountError("Couldn't resolve the fiat price of that asset.")
        amountParsed = amountParsed.div(pair.closePrice)
    }

    return amountParsed
}
export function rawFormatNumber(number:string, separator = ","){
    if(!/^\d+(\.\d+)?$/.test(number))throw new Error("Invalid Number")
    const decimals = number.split(".")[1]
    const mainNumber = number.split(".")[0]
    const offset = mainNumber.length % 3
    let output = mainNumber.slice(0, offset)

    if(offset && offset !== mainNumber.length){
        output += separator
    }

    for(let i = 0; offset+i*3 < mainNumber.length; i++){
        if(i !== 0){
            output += separator
        }
        output += mainNumber.slice(offset+i*3, offset+i*3+3)
    }

    if(decimals){
        return [output, decimals]
    }

    return [output]
}

export function formatNumber(number:string, separator = ","){
    return rawFormatNumber(number, separator).join(".")
}