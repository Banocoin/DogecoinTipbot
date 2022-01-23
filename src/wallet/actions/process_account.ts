import { WalletAddressValidator } from "../types"
import Address from "../../models/Address"
import { tryReceiveStuckTransactions } from "../stuckTransactions"

export default async function processReceiveAccount(address:string){
    await WalletAddressValidator.validateAsync(address)

    const addr = await Address.findOne({
        address
    })
    if(!addr)throw new Error("address not found.")

    await tryReceiveStuckTransactions(addr)

    return null
}