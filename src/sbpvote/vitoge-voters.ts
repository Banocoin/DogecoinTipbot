// Script to distribute rewards.

import "../common/load-env"
import { requestWallet } from "../libwallet/http";
import BigNumber from "bignumber.js"
import { WebsocketConnection } from "../libwallet/ws";
import { dbPromise } from "../common/load-db";
import { tokenDecimals, tokenIds, tokenTickers } from "../common/constants";
import viteQueue from "../cryptocurrencies/viteQueue";
import { convert } from "../common/convert";
import * as vite from "@vite/vitejs"
import { getVITEAddressOrCreateOne } from "../wallet/address";
import { getCurrentCycle } from "../wallet/cycle";
import { WebhookClient } from "discord.js";

const webhook = new WebhookClient({
    url: process.env.VITOGE_WEBHOOK_VOTERS_REWARDS
})
const ws = new WebsocketConnection()

Promise.all([
    dbPromise,
    ws.connect()
]).then(async () => {
    const [
        rewardAddress,
        blockedAddresses
    ] = await Promise.all([
        getVITEAddressOrCreateOne("SBP", "Rewards.Vitoge"),
        Promise.all([
            getVITEAddressOrCreateOne("Mods", "Rewards"),
            getVITEAddressOrCreateOne("SBPClaim", "Rewards"),
            getVITEAddressOrCreateOne("DAO", "Rewards"),
            getVITEAddressOrCreateOne("SBPClaim", "Rewards.Vitoge"),
            getVITEAddressOrCreateOne("SBP", "Rewards"),
            getVITEAddressOrCreateOne("Batch", "Quota")
        ])
    ])
    blockedAddresses.push(rewardAddress)
    console.log(`Vitoge SBP Rewards address: ${rewardAddress.address}`)
    ws.on("tx", async tx => {
        if(tx.to !== rewardAddress.address || tx.type !== "receive")return
        console.log(`Incoming transaction of ${convert(tx.amount, "RAW", tokenTickers[tx.token_id])} ${tokenTickers[tx.token_id]}`)
        if(tx.token_id !== tokenIds.VITE)return
        // we got the payout in vite.
        await viteQueue.queueAction(rewardAddress.address, async () => {
            const balances = await requestWallet("get_balances", rewardAddress.address)
            //const viteBalance = new BigNumber(convert("1126.889821656637320683", "VITE", "RAW"))
            const viteBalance = new BigNumber(balances[tokenIds.VITE])
            const vitogeBalance = new BigNumber(balances[tokenIds.VITOGE])
            const vicatBalance = new BigNumber(balances[tokenIds.VICAT])
            // wait to have at least 400 vite before distributing.
            // will stop if someone sends a ridiculously low amount
            // to the reward address
            if(viteBalance.isLessThan(convert("400", "VITE", "RAW")))return
            // need vitoge to work. The current multiplier is 6mx
            if(!vitogeBalance.isGreaterThan(0))return
            // need vicat to work. The current multiplier is 77x
            if(!vicatBalance.isGreaterThan(0))return

            const votes = await requestWallet("get_sbp_votes", "Vitoge_SBP", getCurrentCycle()-1)
            // Should we reward smart contracts ? I'm not sure but
            // I'll just assume no. I might add exceptions if people asks me to do so.
            let totalValid = new BigNumber(0)
            const validAddresses = []
            for(const address in votes.votes){
                // skip smart contracts
                if(vite.wallet.isValidAddress(address) === vite.wallet.AddressType.Contract)continue
                if(blockedAddresses.map(e => e.address).includes(address))continue

                const vote = new BigNumber(votes.votes[address])
                if(vote.isLessThan(convert("1", "VITE", "RAW")))continue

                totalValid = totalValid.plus(vote)
                validAddresses.push(address)
            }

            // if nobody is valid (shouldn't happen)
            // just stop here and keep the funds for later.
            if(totalValid.isEqualTo(0))return
            const vitogePayouts = []

            let totalVitoge = new BigNumber(0)
            for(const address of validAddresses){
                const amount = new BigNumber(votes.votes[address])
                    .times(viteBalance)
                    // 6m vitoge: 1 vite
                    .times(6e6)
                    .div(totalValid)
                    .toFixed(0)

                // remove potential spams
                if(amount === "0")continue
                totalVitoge = totalVitoge.plus(amount)
                vitogePayouts.push([
                    address,
                    amount
                ])
            }
            if(vitogeBalance.isLessThan(totalVitoge)){
                console.error("Not enough vitoge in balance. Need "+convert(totalVitoge, "RAW", "VITOGE"))
                return
            }
            const vicatPayouts = []

            let totalVicat = new BigNumber(0)
            for(const address of validAddresses){
                const amount = new BigNumber(votes.votes[address])
                    .times(viteBalance)
                    // 77 vicat: 1 vite
                    .times(77)
                    .shiftedBy(tokenDecimals.VICAT)
                    .shiftedBy(-tokenDecimals.VITE)
                    .div(totalValid)
                    .toFixed(0)

                // remove potential spams
                if(amount === "0")continue
                totalVicat = totalVicat.plus(amount)
                vicatPayouts.push([
                    address,
                    amount
                ])
            }
            if(vicatBalance.isLessThan(totalVicat)){
                console.error("Not enough vicat in balance. Need "+convert(totalVicat, "RAW", "VICAT"))
                return
            }

            const payouts = []
            let totalVite = new BigNumber(0)
            for(const address of validAddresses){
                const amount = new BigNumber(votes.votes[address])
                .div(totalValid)
                .times(viteBalance)
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

            
            console.log("Sending VITE...")
            try{
                await requestWallet("bulk_send", rewardAddress.address, payouts, tokenIds.VITE, 40*1000)
            }catch(err){
                console.error(err)
            }
            console.log("Sending VITOGE...")
            try{
                await requestWallet("bulk_send", rewardAddress.address, vitogePayouts, tokenIds.VITOGE, 40*1000)
            }catch(err){
                console.error(err)
            }
            console.log("Sending VICAT...")
            try{
                await requestWallet("bulk_send", rewardAddress.address, vicatPayouts, tokenIds.VICAT, 40*1000)
            }catch(err){
                console.error(err)
            }

            console.log("Sent ! In", (Date.now()-start)/1000, "seconds !")
            console.log("Sending message about distribution...")

            await webhook.send({
                content: `Today's voter rewards were sent!

**${new BigNumber(convert(totalVite, "RAW", "VITE")).toFixed(2)} Vite
${new BigNumber(convert(totalVitoge, "RAW", "VITOGE")).toFixed(0)} Vitoge
${new BigNumber(convert(totalVicat, "RAW", "VICAT")).toFixed(0)} ViCat**

Thanks to all our voters!`
            })
        })
    })
})