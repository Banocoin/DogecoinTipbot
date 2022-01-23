// Script to automatically claim sbp rewards.

import "../common/load-env"
import * as vite from "@vite/vitejs"
import { Platform, tokenIds, tokenTickers } from "../common/constants"
import { convert } from "../common/convert"
import { dbPromise } from "../common/load-db"
import viteQueue from "../cryptocurrencies/viteQueue"
import { requestWallet } from "../libwallet/http"
import { WebsocketConnection } from "../libwallet/ws"
import { IAddress } from "../models/Address"
import { getVITEAddressOrCreateOne } from "../wallet/address"
import BigNumber from "bignumber.js"
import lt from "long-timeout"
import { wait } from "../common/util"

const VITC_TREASURY = "vite_4041e7e3d80f879001b7ff67dbef4be23827b65131ef2c79ac"

const destinations = [
    {
        percent: 40,
        // voters distribution
        address: "SBP.Rewards.Vitoge"
    },
    {
        percent: 60,
        // Vitoge treasury
        address: "vite_3286b588ac2808e52f70e0a5e73b335ace8750c4fc6103eaf2"
    }
]
const sbp = "Vitoge_SBP"
const fee = convert("10", "VITE", "RAW")

const ws = new WebsocketConnection()

Promise.all([
    dbPromise,
    ws.connect()
]).then(async () => {
    let totalPercent = 0
    let sbpClaimAddress:IAddress
    const promises = [
        (async()=>{
            sbpClaimAddress = await getVITEAddressOrCreateOne("SBPClaim", "Rewards.Vitoge")
        })()
    ]
    for(const destination of destinations){
        if(destination.percent <= 0)throw new Error("Invalid percent")
        totalPercent += destination.percent
        if(!vite.wallet.isValidAddress(destination.address)){
            promises.push((async ()=>{
                const parts = destination.address.split(".")
                const address = await getVITEAddressOrCreateOne(parts[0], parts.slice(1).join(".") as Platform)
                destination.address = address.address
            })())
        }
    }
    if(totalPercent !== 100){
        console.error("The total percent distribution plan isn't equal to 100%")
        process.exit()
    }
    await Promise.all(promises)
    console.log("SBP Claim address", sbpClaimAddress.address)

    ws.on("tx", async tx => {
        if(tx.to !== sbpClaimAddress.address || tx.type !== "receive")return
        console.log(`Incoming transaction of ${convert(tx.amount, "RAW", tokenTickers[tx.token_id])} ${tokenTickers[tx.token_id]}`)
        if(tx.token_id !== tokenIds.VITE)return

        await viteQueue.queueAction(sbpClaimAddress.address, async () => {
            const balances = await requestWallet("get_balances", sbpClaimAddress.address)
            // let viteBalance = new BigNumber(convert("2200", "VITE", "RAW"))
            let viteBalance = new BigNumber(balances[tokenIds.VITE])
            // wait to have at least 400 vite before distributing.
            // will stop if someone sends a ridiculously low amount
            // to the claim address
            if(viteBalance.isLessThan(convert("400", "VITE", "RAW")))return

            // math time :)
            const payouts:[string, string][] = [
                [
                    VITC_TREASURY,
                    fee
                ]
            ]
            viteBalance = viteBalance.minus(fee)
            for(const destination of destinations){
                const amount = viteBalance.times(destination.percent).div(100)
                if(amount.isLessThan(1))continue
                payouts.push([
                    destination.address,
                    amount.toFixed(0)
                ])
            }
            // math time finished :(
            const start = Date.now()

            await requestWallet("bulk_send", sbpClaimAddress.address, payouts, tokenIds.VITE)
            
            console.log("Sent ! In", (Date.now()-start)/1000, "seconds !")
        })
    })

    // check rewards and withdraw functions
    const checkRewards = async () => {
        const rewards = await requestWallet("get_sbp_rewards_pending_withdrawal", sbp)
        if(rewards.totalReward === "0")return
        console.log("Withdrawing rewards...")

        await requestWallet(
            "withdraw_sbp_rewards", 
            sbpClaimAddress.address, 
            sbpClaimAddress.address, 
            sbp
        )
    }
    const checkUnreceivedTransactions = async () => {
        await requestWallet("process_account", sbpClaimAddress.address)
    }
    await checkRewards()
    // every 30 minutes
    lt.setInterval(checkRewards, 30*60*1000)
    // wait 10 seconds
    await wait(10000)
    // every 30 minutes
    lt.setInterval(checkUnreceivedTransactions, 30*60*1000)
    await checkUnreceivedTransactions()

})