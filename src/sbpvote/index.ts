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
import { WebhookClient } from "discord.js";
import Twit from "twitter-api-v2"
import { durationUnits } from "../common/util";
import { getBlockedAddresses } from "./util";

const ws = new WebsocketConnection()

const webhook = new WebhookClient({
    url: process.env.WEBHOOK_VOTERS_REWARDS
})
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
            // wait to have at least 400 vite before distributing.
            // will stop if someone sends a ridiculously low amount
            // to the reward address
            if(viteBalance.isLessThan(convert("400", "VITE", "RAW")))return
            // need vitc to work. The current multiplier is 100x
            if(!vitcBalance.isGreaterThan(0))return

            const votes = await requestWallet("get_sbp_votes", process.env.SBP_NAME || "VitaminCoinSBP", getCurrentCycle()-1)
            // Should we reward smart contracts ? I'm not sure but
            // I'll just assume no. I might add exceptions if people asks me to do so.
            let totalValid = new BigNumber(0)
            const validAddresses = []
            const one = convert("1", "VITE", "RAW")
            const promises = []
            for(const address in votes.votes){
                if(blockedAddresses.includes(address))continue
                // skip smart contracts
                if(vite.wallet.isValidAddress(address) === vite.wallet.AddressType.Contract)continue

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
            const vitcPayouts = []

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
                    address,
                    amount
                ])
            }
            if(vitcBalance.isLessThan(totalVitc)){
                console.error("Not enough vitc in balance. Need "+convert(totalVitc, "RAW", "VITC"))
                return
            }
            const payouts = []
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
                    address,
                    amount
                ])
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

            console.log("Sent ! In", (Date.now()-start)/1000, "seconds !")
            console.log("Sending tweets and messages about distribution...")
            
            // send tweets and messages about distribution
            await Promise.all([
                webhook.send(`Today's 💊 voter rewards were sent!

**${Math.round(parseFloat(convert(totalVite, "RAW", "VITE")))} ${tokenNameToDisplayName("VITE")} <:ViteV3:919478731150590012>**!

And

**${Math.round(parseFloat(convert(totalVitc, "RAW", "VITC")))} ${tokenNameToDisplayName("VITC")} <:vitc_logo:912246312777445376>**!

Thanks to all our voters!`),
                twitc.v1.tweet(`Today's 💊 voter rewards were sent!

${Math.round(parseFloat(convert(totalVite, "RAW", "VITE")))} ${tokenNameToDisplayName("VITE")}!

And

${Math.round(parseFloat(convert(totalVitc, "RAW", "VITC")))} ${tokenNameToDisplayName("VITC")}!

Thanks to all our voters!`)
            ])
        })
    })
})
