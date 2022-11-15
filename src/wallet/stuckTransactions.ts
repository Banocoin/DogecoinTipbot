import Address, { IAddress } from "../models/Address"
import { wsProvider, tokenIds } from "./node"
import asyncPool from "tiny-async-pool";
import { wait } from "../common/util";
import { receive, skipReceiveBlocks } from "./receive";
import PendingTransaction from "../models/PendingTransaction";
import { processBulkTransactions } from "./send";

export default async function initStuckTransactionService():Promise<never>{
    try{
        await PendingTransaction.find()
        .populate("address")
        .exec()
        .then(processBulkTransactions)
    }catch(err){
        console.error(err)
    }

    // eslint-disable-next-line no-constant-condition
    while(true){
        try{
            await searchStuckTransactions()
        }catch(err){
            console.error(err)
        }
    }
}
export async function searchStuckTransactions(){
    const addresses = await Address.find()
    await asyncPool(50, addresses, async address => {
        return tryReceiveStuckTransactions(address)
    })
    await wait(10000)
}
export async function tryReceiveStuckTransactions(address:IAddress){
    const tokens = Object.keys(tokenIds)
    try{
        // eslint-disable-next-line no-constant-condition
        while(true){
            const shouldStop = await (async () => {
                const blocks = await wsProvider.request(
                    "ledger_getUnreceivedBlocksByAddress",
                    address.address,
                    0,
                    20
                )
                if(blocks.length === 0)return true
                for(const block of blocks.sort((b1, b2) => {
                    if(b1.tokenId === b2.tokenId){
                        const diff = BigInt(b1.amount)-BigInt(b2.amount)
                        if(diff < 0n){
                            return -1
                        }else if(diff === 0n){
                            return 0
                        }else if(diff > 0n){
                            return 1
                        }
                    }else{
                        const i1 = tokens.indexOf(b1.tokenId)
                        const i2 = tokens.indexOf(b2.tokenId)
                        if(i1 === i2)return 0
                        if(i1 < 0)return -1
                        if(i2 < 0)return 1
                        return i2-i1
                    }
                })){
                    if(skipReceiveBlocks.has(block.hash))continue
                    skipReceiveBlocks.add(block.hash)

                    await receive(block, address)
                    skipReceiveBlocks.delete(block.hash)
                }
                return false
            })()
            if(shouldStop)break
        }
    }catch(err){
        console.error(err)
    }
}