import "../common/load-env"
import BigNumber from "bignumber.js";
import { dbPromise } from "../common/load-db"
import { requestWallet } from "../libwallet/http";
import { getVITEAddressOrCreateOne } from "../wallet/address";
import { tokenIds } from "../common/constants";
import { convert } from "../common/convert";
import fetch from "node-fetch";
import { wallet } from "@vite/vitejs";

const amountRaw:[string, string] = ["25", "XLM"]

dbPromise.then(async () => {
    console.log("Sending from Thomiz's account")
    const account = await getVITEAddressOrCreateOne("696481194443014174", "Discord")
    const token = tokenIds[amountRaw[1]]
    if(!token){
        console.error(`No token found: ${amountRaw[1]}`)
        process.exit()
    }

    const res = await fetch("https://airdrop.vitc.org/api/registered?key="+process.env.DAO_REGISTER_KEY)
    
    const validAddress = (await res.json())
        .map(e => e.address)
        .filter(e => {
            if(!wallet.isValidAddress(e)){
                console.error(e, "isn't a valid address")
                return false
            }
            return true
        })
    if(validAddress.length === 0){
        console.error("No valid addresses were found. Aborting.")
        process.exit(1)
    }
    const amount = convert(...amountRaw, "RAW")
    console.log("Sending to "+validAddress.length)
    const payouts = []
    let total = new BigNumber(0)
    for(const address of validAddress){
        const payout = [
            address,
            new BigNumber(amount).div(validAddress.length).toFixed(0)
        ]
        payouts.push(payout)
        total = total.plus(payout[1])
    }
    const balances = await requestWallet("get_balances", account.address)
    const balance = new BigNumber(balances[token] || 0)
    if(balance.isLessThan(total)){
        console.error(`Not enough balance. Needs ${convert(total, "RAW", amountRaw[1])} ${amountRaw[1]}.`)
        process.exit(1)
    }

    console.log(`Sending ${amountRaw[1]} to ${validAddress.length} addresses`)
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
            )
            console.log("Done! waiting 75 seconds.")
        }
    }catch(err){
        console.log(err.length, "errs")
        console.error(err)
    }

    console.log("Sent amount!")
    process.exit()
})