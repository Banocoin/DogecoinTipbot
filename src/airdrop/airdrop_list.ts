import "../common/load-env"
import BigNumber from "bignumber.js";
import { dbPromise } from "../common/load-db"
import { requestWallet } from "../libwallet/http";
import { getVITEAddressOrCreateOne } from "../wallet/address";
import { tokenIds } from "../common/constants";
import { convert } from "../common/convert";
import { wallet } from "@vite/vitejs";
import data from "./data.json"

const currency = "LUNA"
dbPromise.then(async () => {
    console.log("Sending from Thomiz's account")
    const account = await getVITEAddressOrCreateOne("696481194443014174", "Discord")
    const token = tokenIds[currency]
    if(!token){
        console.error(`No token found: ${currency}`)
        process.exit()
    }

    const validAddress = data
        .filter(e => {
            if(!wallet.isValidAddress(e[0])){
                console.error(e[0], "isn't a valid address")
                return false
            }
            return true
        })
    if(validAddress.length === 0){
        console.error("No valid addresses were found. Aborting.")
        process.exit(1)
    }
    console.log("Sending to", validAddress.length, "addresses")
    const payouts = []
    let total = new BigNumber(0)
    for(const payout of validAddress){
        payouts.push(payout)
        total = total.plus(payout[1])
    }
    const balances = await requestWallet("get_balances", account.address)
    const balance = new BigNumber(balances[token] || 0)
    if(balance.isLessThan(total)){
        console.error(`Not enough balance. Needs ${convert(total, "RAW", currency)} ${currency}.`)
        process.exit(1)
    }

    console.log(`Sending ${convert(total, "RAW", currency)} ${currency} to ${validAddress.length} addresses`)
    try{
        for(let i = 0; i*450 < payouts.length; i++){
            const offset = i*450
            const pays = payouts.slice(offset, offset+450)
            console.log("Sending to", pays.length, "addresses...")
            await requestWallet(
                "bulk_send",
                account.address,
                pays,
                token,
                75000
            ).catch(console.error)
            console.log("Done! waiting 75 seconds.")
        }
    }catch(err){
        console.log(err.length, "errs")
        console.error(err)
    }

    console.log("Sent amount!")
    process.exit()
})