// Script to distribute rewards.

import "../common/load-env"
import { requestWallet } from "../libwallet/http";
import BigNumber from "bignumber.js"
import { WebsocketConnection } from "../libwallet/ws";
import { dbPromise } from "../common/load-db";
import { tokenIds, tokenTickers } from "../common/constants";
import viteQueue from "../cryptocurrencies/viteQueue";
import { convert, tokenNameToDisplayName } from "../common/convert";
import * as vite from "@vite/vitejs"
import { getVITEAddressOrCreateOne } from "../wallet/address";
import SBPVote from "../models/SBPVote";
import { getCurrentCycle } from "../wallet/cycle";
import Twit from "twitter-api-v2"
import { durationUnits } from "../common/util";
import { getBlockedAddresses } from "./util";

const redirects = {
    // VITCSwap v0.1 to treasury
    vite_29ae0b9f951323b3bfe9bb8251bba2830eddacf51631630495: "vite_4041e7e3d80f879001b7ff67dbef4be23827b65131ef2c79ac",

    // VITCStake v0.1 to treasury
    vite_cc2d0c2c34ae6af8bd58e111ca8c958d002c2b3199f449c8d7: "vite_4041e7e3d80f879001b7ff67dbef4be23827b65131ef2c79ac",
    // VITCStake v0.2 to treasury
    vite_c85b335e221fc99631785f3d579edd1b7a2691131b7f3998a3: "vite_4041e7e3d80f879001b7ff67dbef4be23827b65131ef2c79ac",

    // ViteLabs's 1m votes gift to treasury
    vite_a5472d9018fc9f1ce0e1f470c4016073b1d2cb5a2ff732ae36: "vite_4041e7e3d80f879001b7ff67dbef4be23827b65131ef2c79ac"
}

const ws = new WebsocketConnection()

const twitc = new Twit({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})

Promise.all([
    dbPromise,
    ws.connect()
]).then(async () => {
    const [
        rewardAddress,
        blockedAddresses
    ] = await Promise.all([
        getVITEAddressOrCreateOne("SBP", "Rewards"),
        getBlockedAddresses()
    ])
    console.log(`SBP Rewards address: ${rewardAddress.address}`)
    ws.on("tx", async tx => {
        if(tx.to !== rewardAddress.address || tx.type !== "receive")return
        console.log(`Incoming transaction of ${convert(tx.amount, "RAW", tokenTickers[tx.token_id])} ${tokenTickers[tx.token_id]}`)
        if(tx.token_id !== tokenIds.VITE)return
        // we got the payout in vite.
        await viteQueue.queueAction(rewardAddress.address, async () => {
            const balances = await requestWallet("get_balances", rewardAddress.address)
            //const viteBalance = new BigNumber(convert("1883.86360327", "VITE", "RAW"))
            const viteBalance = new BigNumber(balances[tokenIds.VITE])
            const vitcBalance = new BigNumber(balances[tokenIds.VITC])
            const hbitBalance = new BigNumber(balances[tokenIds.HBIT])
            // wait to have at least 400 vite before distributing.
            // will stop if someone sends a ridiculously low amount
            // to the reward address
            if(viteBalance.isLessThan(convert("400", "VITE", "RAW")))return
            // need vitc to work. The current multiplier is 100x
            if(!vitcBalance.isGreaterThan(0))return

            const votes = await requestWallet("get_sbp_votes", process.env.SBP_NAME || "VitaminCoin_SBP", getCurrentCycle()-1)
            // Should we reward smart contracts ? I'm not sure but
            // I'll just assume no. I might add exceptions if people asks me to do so.
            let totalValid = new BigNumber(0)
            const validAddresses = []
            const one = convert("1", "VITE", "RAW")
            const promises = []
            for(const address in votes.votes){
                if(blockedAddresses.includes(address))continue
                // skip smart contracts
                if(vite.wallet.isValidAddress(address) === vite.wallet.AddressType.Contract){
                    if(!(address in redirects))continue
                }

                promises.push((async () => {
                    let sbpVote = await SBPVote.findOne({
                        address: address
                    })
                    if(!sbpVote){
                        // No document, create it ?
                        // means the wallet system was offline.
                        try{
                            sbpVote = await SBPVote.create({
                                since: new Date(),
                                address: address
                            })
                        }catch{}
                        return
                    }else{
                        // if less than a day since registration.
                        if(sbpVote.since.getTime() > Date.now()-durationUnits.h)return
                    }
                    if(new BigNumber(votes.votes[address]).isLessThan(one))return
    
                    totalValid = totalValid.plus(votes.votes[address])
                    validAddresses.push(address)
                })())
            }
            await Promise.all(promises)

            // if nobody is valid (shouldn't happen)
            // just stop here and keep the funds for later.
            if(totalValid.isEqualTo(0))return
            const vitcPayouts:[string, string][] = []

            //const cap = new BigNumber(convert(7500, "VITC", "RAW"))
            let totalVitc = new BigNumber(0)
            for(const address of validAddresses){
                const amount = new BigNumber(votes.votes[address])
                    .times(50)
                    .times(viteBalance)
                    .div(totalValid)
                    .toFixed(0)

                // remove potential spams
                if(amount === "0")continue
                /*if(amount.isGreaterThan(cap)){
                    amount = cap
                }*/
                totalVitc = totalVitc.plus(amount)
                vitcPayouts.push([
                    redirects[address] || address,
                    amount
                ])
            }
            if(vitcBalance.isLessThan(totalVitc)){
                console.error("Not enough vitc in balance. Need "+convert(totalVitc, "RAW", "VITC"))
                return
            }
            const payouts:[string, string][] = []
            let totalVite = new BigNumber(0)
            for(const address of validAddresses){
                const amount = new BigNumber(votes.votes[address])
                .times(viteBalance)
                .div(totalValid)
                .toFixed(0)

                // remove potential spams
                if(amount === "0")continue
                totalVite = totalVite.plus(amount)
                payouts.push([
                    redirects[address] || address,
                    amount
                ])
            }
            const hbitPayouts:[string, string][] = []
            let totalHbit = new BigNumber(0)
            const hbitAmount = convert(60000, "HBIT", "RAW")
            if(hbitBalance.isGreaterThanOrEqualTo(hbitAmount)){
                for(const address of validAddresses){
                    const amount = new BigNumber(votes.votes[address])
                    .times(hbitAmount)
                    .div(totalValid)
                    .toFixed(0)
    
                    // remove potential spams
                    if(amount === "0")continue
                    totalHbit = totalHbit.plus(amount)
                    hbitPayouts.push([
                        redirects[address] || address,
                        amount
                    ])
                }
            }

            for(const array of [payouts, vitcPayouts, hbitPayouts]){
                const addresses = new Set<string>(array.map(e => e[0]))

                for(const address of addresses){
                    const payouts = array.filter(e => e[0] === address)
                    if(payouts.length <= 1)continue
                    
                    // eslint-disable-next-line no-constant-condition
                    while(true){
                        const index = array.findIndex(e => e[0] === address)
                        if(index === -1)break

                        array.splice(index, 1)
                    }

                    let total = new BigNumber(0)
                    for(const payout of payouts){
                        total = total.plus(payout[1])
                    }

                    array.push([address, total.toFixed(0)])
                }
            }
            
            const start = Date.now()

            try{
                await requestWallet("bulk_send", rewardAddress.address, payouts, tokenIds.VITE, 75*1000)
            }catch(err){
                console.error(err)
            }
            try{
                await requestWallet("bulk_send", rewardAddress.address, vitcPayouts, tokenIds.VITC, 75*1000)
            }catch(err){
                console.error(err)
            }

            if(hbitBalance.isGreaterThanOrEqualTo(hbitAmount)){
                try{
                    await requestWallet("bulk_send", rewardAddress.address, hbitPayouts, tokenIds.HBIT, 75*1000)
                }catch(err){
                    console.error(err)
                }
            }

            console.log("Sent ! In", (Date.now()-start)/1000, "seconds !")
            console.log("Sending tweets and messages about distribution...")
            

            if(hbitBalance.isGreaterThanOrEqualTo(hbitAmount)){
                await twitc.v1.tweet(`Today's 💊 voter rewards were sent!
    
${Math.round(parseFloat(convert(totalVite, "RAW", "VITE")))} ${tokenNameToDisplayName("VITE")}!

${Math.round(parseFloat(convert(totalVitc, "RAW", "VITC")))} ${tokenNameToDisplayName("VITC")}!

And

${Math.round(parseFloat(convert(totalHbit, "RAW", "HBIT")))} ${tokenNameToDisplayName("HBIT")}!

Thanks to all our voters!`)
            }else{
                // send tweets and messages about distribution
                await twitc.v1.tweet(`Today's 💊 voter rewards were sent!
    
${Math.round(parseFloat(convert(totalVite, "RAW", "VITE")))} ${tokenNameToDisplayName("VITE")}!

And

${Math.round(parseFloat(convert(totalVitc, "RAW", "VITC")))} ${tokenNameToDisplayName("VITC")}!

Thanks to all our voters!`)
            }
        })
    })
})
