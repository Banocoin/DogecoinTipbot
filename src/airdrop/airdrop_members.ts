import "../common/load-env"
import BigNumber from "bignumber.js";
import { dbPromise } from "../common/load-db"
import { requestWallet } from "../libwallet/http";
import { getVITEAddressOrCreateOne } from "../wallet/address";
import { tokenIds } from "../common/constants";
import { convert } from "../common/convert";

const data = require("../../members.json")
if(data.length === 0){
    console.error("Please add the list of addresses to send to.")
    process.exit(1)
}
dbPromise.then(async () => {
    console.log("Sending from Thomiz's account")
    const account = await getVITEAddressOrCreateOne("696481194443014174", "Discord")

    const memberRole = "907279842716835883"
    const healthyRole = "907561831831318538"
    const amounts = {}
    const validAddress:string[] = (await Promise.all(data.map(async member => {
        if(!member.roles.includes(memberRole) && !member.roles.includes(healthyRole))return null
        const address = await getVITEAddressOrCreateOne(member.id, "Discord")
        amounts[address.address] = member.roles.includes(memberRole) ? 500 : 0
        amounts[address.address] += member.roles.includes(healthyRole) ? 500 : 0
        return address.address as string
    }))).filter(e => !!e) as string[]
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
            convert(amounts[address], "VITC", "RAW")
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