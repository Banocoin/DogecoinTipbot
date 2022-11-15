import BigNumber from "bignumber.js";
import { payout, VPoWAddress } from ".";
import { tokenIds } from "../common/constants";
import { convert } from "../common/convert";
import viteQueue from "../cryptocurrencies/viteQueue";
import { requestWallet } from "../libwallet/http";
import VPoWPayout from "../models/VPoWPayout";

export function distributeRewards(before:number){
    viteQueue.queueAction(VPoWAddress.address, async () => {
        try{
            console.log(`[REWARDS] Calculating rewards`)
            const tokenId = tokenIds[payout[1]]
            if(!tokenId)return console.error(`[REWARDS] Unknown currency: ${payout[1]}`)
        
            const rewards = await VPoWPayout.find({
                date: {
                    $lt: new Date(before)
                }
            })
            if(!rewards.length)return console.error(`[REWARDS] No rewards to distribute`)
        
            const amounts = {}
            for(const reward of rewards){
                amounts[reward.address] = (amounts[reward.address] || new BigNumber(0)).plus(payout[0])
            }
        
            const payouts = []
            let total = new BigNumber(0)
            for(const address in amounts){
                const amount = convert(amounts[address], payout[1], "RAW")
                payouts.push([
                    address,
                    amount
                ])
                total = total.plus(amount)
            }
        
            const balances = await requestWallet("get_balances", VPoWAddress.address)
            const balance = balances[tokenId]
        
            if(total.isGreaterThan(balance)){
                console.error(`[REWARDS] Not enough balance. Please top up ${VPoWAddress.address}`)
                return
            }
        
            // at this point we're sending, let's first delete payouts from database
            console.log(`[REWARDS] Deleting from database`)
            await VPoWPayout.deleteMany({
                $or: rewards.map(reward => {
                    return {
                        _id: reward.id
                    }
                })
            })
        
            console.log(`[REWARDS] Sending`)
            const start = Date.now()
            await requestWallet("bulk_send", VPoWAddress.address, payouts, tokenId)
            console.log(`[REWARDS] Sent in ${(Date.now()-start)/1000} seconds`)
            payout[0] = "0.5"
        }catch(err){
            console.error(err)
        }
    })
}