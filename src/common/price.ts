import BigNumber from "bignumber.js";
import fetch from "node-fetch";
import { disabledTokens, tokenIds } from "./constants";

export let tokenPrices = {}
const ordering = [
    tokenIds.USDT,
    tokenIds.VITE,
    tokenIds.BTC,
    tokenIds.ETH
]

export async function fetchPrices(){
    const res = await fetch("https://api.vitex.net/api/v2/ticker/24hr")
    const json = await res.json()
    if(json.code !== 0)throw new Error(json.msg)
    tokenPrices = {}
    for(const pair of json.data){
        if(pair.tradeToken in disabledTokens)continue
        tokenPrices[`${pair.tradeToken}/${pair.quoteToken}`] = pair
    }

    // set usdt price
    tokenPrices[`${tokenIds.USDT}/${tokenIds.USDT}`] = getUSDTPair()

    // now, we need to resolve USD Prices
    // we'll take USDT as USD (even if it's not backed lol)
    for(const pair of json.data.sort((a, b) => {
        return ordering.indexOf(a.quoteToken)-ordering.indexOf(b.quoteToken)
    })){
        if(pair.tradeToken in disabledTokens)continue
        const pairId = `${pair.tradeToken}/${pair.quoteToken}`
        const usdtPairId = `${pair.tradeToken}/${tokenIds.USDT}`
        tokenPrices[pairId] = pair
        if(tokenPrices[usdtPairId])continue

        tokenPrices[usdtPairId] = resolveUSDPair(pair)
    }

    // Also resolve vite pairs
    for(const pair of json.data.sort((a, b) => {
        return ordering.indexOf(a.quoteToken)-ordering.indexOf(b.quoteToken)
    })){
        if(pair.tradeToken in disabledTokens)continue
        const pairId = `${pair.tradeToken}/${pair.quoteToken}`
        const vitePairId = `${pair.tradeToken}/${tokenIds.VITE}`
        tokenPrices[pairId] = pair
        if(tokenPrices[vitePairId])continue

        tokenPrices[vitePairId] = resolveVITEPair(pair)
    }
}

fetchPrices()
setInterval(fetchPrices, 60000)

export function getUSDTPair(){
    return {
        symbol: "USDT-000_USDT-000",
        tradeTokenSymbol: "USDT-000",
        quoteTokenSymbol: "USDT-000",
        tradeToken: tokenIds.USDT,
        quoteToken: tokenIds.USDT,
        operatorName: "Vite Gateway",
        openPrice: "1.00",
        prevClosePrice: "1.00",
        closePrice: "1.00",
        priceChange: "0.00",
        priceChangePercent: 0,
        highPrice: "1.00",
        lowPrice: "1.00",
        quantity: "0.00000000",
        amount: "0.00000000",
        pricePrecision: 2,
        quantityPrecision: 1,
        openTime: null,
        closeTime: null
    }
}
export function resolveUSDPair(pair:any){
    const quotePair = tokenPrices[`${pair.quoteToken}/${tokenIds.USDT}`]
    return {
        ...pair,
        symbol: `${pair.tradeTokenSymbol}_USDT-000`,
        quoteTokenSymbol: "USDT-000",
        quoteToken: tokenIds.USDT,
        openPrice: new BigNumber(quotePair.openPrice).times(pair.openPrice).toFixed(),
        prevClosePrice: new BigNumber(quotePair.prevClosePrice).times(pair.prevClosePrice).toFixed(),
        closePrice: new BigNumber(quotePair.closePrice).times(pair.closePrice).toFixed(),
        pricePrecision: quotePair.pricePrecision+pair.pricePrecision,
        quantityPrecision: quotePair.quantityPrecision+pair.quantityPrecision
    }
}
export function resolveVITEPair(pair:any){
    const quotePair = tokenPrices[`${tokenIds.VITE}/${pair.quoteToken}`]
    return {
        ...pair,
        symbol: `${pair.tradeTokenSymbol}_VITE-000`,
        quoteTokenSymbol: "VITE-000",
        quoteToken: tokenIds.VITE,
        openPrice: new BigNumber(1).div(quotePair.openPrice).times(pair.openPrice).toFixed(),
        prevClosePrice: new BigNumber(1).div(quotePair.prevClosePrice).times(pair.prevClosePrice).toFixed(),
        closePrice: new BigNumber(1).div(quotePair.closePrice).times(pair.closePrice).toFixed(),
        pricePrecision: quotePair.pricePrecision+pair.pricePrecision,
        quantityPrecision: quotePair.quantityPrecision+pair.quantityPrecision
    }
}