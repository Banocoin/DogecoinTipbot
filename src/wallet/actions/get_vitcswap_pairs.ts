// Get VITCSwap pairs from the contract events

import { getPairs } from "../vitcswap"

export default async function getVITCSwapPairs(){
    return getPairs()
}