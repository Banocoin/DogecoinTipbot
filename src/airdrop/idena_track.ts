import "../common/load-env"
import { requestWallet } from "../libwallet/http";
import * as vite from "@vite/vitejs"

;import { tokenIds } from "../common/constants";
(async () => {
    const airdrop = require("../../idena.json")
    const proxiedAddresses = {}
    for(const recipient of airdrop){
        const address = recipient.Address
        if(!vite.wallet.isValidAddress(address)){
            console.error("invalid Address:", address)
            continue
        }

        const balance = await requestWallet(
            "get_balances",
            address
        )
        // not a proxy account
        if(balance[tokenIds.VITC] !== "0")continue
        console.log(address, balance[tokenIds.VITC])
    
        const transactions = await requestWallet(
            "get_account_blocks",
            address,
            null,
            null,
            100
        )
        if(transactions.length !== 2)continue
        
        const transaction = transactions[0]
        // likely vitex/vote
        if(vite.wallet.isValidAddress(transaction.toAddress) == vite.wallet.AddressType.Contract)continue
        proxiedAddresses[transaction.toAddress] = proxiedAddresses[transaction.toAddress] || 0
        proxiedAddresses[transaction.toAddress]++
    }
    console.log(proxiedAddresses)
})()