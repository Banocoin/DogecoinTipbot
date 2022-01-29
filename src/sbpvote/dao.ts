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
import fetch from "node-fetch"
import { WebhookClient } from "discord.js";
import Twit from "twitter-api-v2"
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

const minimums = {
    [tokenIds.VITE]: convert("400", "VITE", "RAW"),
    [tokenIds.VIVA]: convert("100000", "VIVA", "RAW"),
    [tokenIds.VITC]: convert("6000", "VITC", "RAW"),
    [tokenIds.UST]: convert("5", "UST", "RAW"),
    // 5$ in Luna
    [tokenIds.LUNA]: convert("0.1", "LUNA", "RAW")
}

Promise.all([
    dbPromise,
    ws.connect()
]).then(async () => {
    const [
        DAOAddress,
        blockedAddresses
    ] = await Promise.all([
        getVITEAddressOrCreateOne("DAO", "Rewards"),
        getBlockedAddresses()
    ])
    console.log(`DAO Rewards address: ${DAOAddress.address}`)
    ws.on("tx", async tx => {
        if(tx.to !== DAOAddress.address || tx.type !== "receive")return
        const ticker = tokenTickers[tx.token_id]
        console.log(`Incoming transaction of ${convert(tx.amount, "RAW", ticker)} ${ticker}`)
        if(!minimums[tx.token_id])return
        // we got the payout in vite.
        await viteQueue.queueAction(DAOAddress.address, async () => {
            const balances = await requestWallet("get_balances", DAOAddress.address)
            //const viteBalance = new BigNumber(convert("1058.13308235", "VITE", "RAW"))
            const viteBalance = new BigNumber(balances[tx.token_id] || 0)
            // wait to have at least 40 vite before distributing.
            // will stop if someone sends a ridiculously low amount
            // to the reward address
            if(viteBalance.isLessThan(minimums[tx.token_id]))return
            console.log(`${ticker} balance: ${convert(viteBalance, "RAW", ticker)} ${ticker}`)
            console.log("refreshing register api")

            // refresh balances
            await fetch("https://register.vitamincoin.org/api/forcerebal?key="+process.env.DAO_REGISTER_KEY)

            console.log("Finished refreshing")
            console.log("Fetching register api")

            // fetch addresses and balances
            const res = await fetch("https://register.vitamincoin.org/api/balance?key="+process.env.DAO_REGISTER_KEY)
            const addresses = (await res.json()) as {
                balance: string,
                address: string  
            }[]
            console.log("Finished fetching")

            let totalValid = new BigNumber(0)
            const validAddresses = []
            for(const {
                address,
                balance
            } of addresses){
                if(blockedAddresses.includes(address))continue
                // skip smart contracts
                if(vite.wallet.isValidAddress(address) === vite.wallet.AddressType.Contract)continue

                if(new BigNumber(balance).isLessThan(convert("1", "VITC", "RAW"))){
                    console.log(`Skipping ${address} because less than 1 vitc`)
                    continue
                }

                totalValid = totalValid.plus(balance)
                validAddresses.push(address)
            }

            // if nobody is valid (shouldn't happen)
            // just stop here and keep the funds for later.
            if(totalValid.isEqualTo(0))return

            const payouts = []
            let totalVite = new BigNumber(0)
            for(const address of validAddresses){
                const amount = new BigNumber(addresses.find(e => e.address == address).balance)
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
            if(viteBalance.isLessThan(totalVite)){
                console.error("Not enough "+ticker+" in balance. Need "+convert(totalVite, "RAW", ticker))
                return
            }
            
            const start = Date.now()

            try{
                await requestWallet("bulk_send", DAOAddress.address, payouts, tx.token_id, 75*1000)
            }catch(err){
                console.error(err)
            }

            console.log(`Sent to ${payouts.length} addresses, was ${addresses.length} on dao response.`)

            console.log("Sent ! In", (Date.now()-start)/1000, "seconds !")
            console.log("Sending tweets and messages about distribution...")
            
            // send tweets and messages about distribution
            await Promise.all([
                webhook.send(`Today's 💊 DAO rewards were sent!

**${Math.round(parseFloat(convert(totalVite, "RAW", ticker)))} ${tokenNameToDisplayName(ticker)} ${ticker === "VITE" ? "<:ViteV3:919478731150590012>" : ""}**!

Thanks to all our holders! Register on https://register.vitamincoin.org`),
                twitc.v1.tweet(`Today's 💊 DAO rewards were sent!

${Math.round(parseFloat(convert(totalVite, "RAW", ticker)))} ${tokenNameToDisplayName(ticker)}!

Thanks to all our holders! Register on https://register.vitamincoin.org`)
            ])
        })
    })
})