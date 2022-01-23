import "../common/load-env"
import BigNumber from "bignumber.js";
import { dbPromise } from "../common/load-db"
import { requestWallet } from "../libwallet/http";
import { getVITEAddressOrCreateOne } from "../wallet/address";
import { tokenIds } from "../common/constants";
import { convert } from "../common/convert";
import fetch from "node-fetch";
import { wallet } from "@vite/vitejs";

dbPromise.then(async () => {
    console.log("Sending from Thomiz's account")
    const account = await getVITEAddressOrCreateOne("696481194443014174", "Discord")

    const amount = convert("1000", "VITC", "RAW")
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
    console.log("Sending to "+validAddress.length)
    const payouts = []
    let total = new BigNumber(0)
    for(const address of validAddress){
        const payout = [
            address,
            amount
        ]
        payouts.push(payout)
        total = total.plus(payout[1])
    }
    const balances = await requestWallet("get_balances", account.address)
    const balance = new BigNumber(balances[tokenIds.VITC] || 0)
    if(balance.isLessThan(total)){
        console.error("Not enough balance. Needs "+convert(total, "RAW", "VITC")+" VITC.")
        process.exit(1)
    }

    console.log(`Sending VITC to ${validAddress.length} addresses`)

    try{
        for(let i = 0; i*450 < payouts.length; i++){
            const offset = i*450
            const pays = payouts.slice(offset, offset+450)
            console.log("Sending to", pays.length, "addresses...")
            await requestWallet(
                "bulk_send",
                account.address,
                pays,
                tokenIds.VITC,
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