// Get VITCSwap conversion for amount, token0 and token1

import { AmountValidator, TokenIdValidator } from "../types"
import { getConversion } from "../vitcswap"

export default async function getVITCSwapConversion(amount:string, token0:string, token1:string){
    await AmountValidator.validateAsync(amount)
    await TokenIdValidator.validateAsync(token0)
    await TokenIdValidator.validateAsync(token1)
    return getConversion(amount, token0, token1)
}