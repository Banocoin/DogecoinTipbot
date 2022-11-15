import "../common/load-env"
import * as vite from "@vite/vitejs"
import { requestWallet } from "../libwallet/http"

const [
    from,
    to
] = process.argv.slice(2)

if(!vite.wallet.isValidAddress(from))throw new Error(`Invalid from address: ${from}`)
if(!vite.wallet.isValidAddress(to))throw new Error(`Invalid to address: ${to}`)

requestWallet("get_balances", from)
.then(async balances => {
    for(const token in balances){
        if(balances[token] === "0")continue
        await requestWallet("send", from, to, balances[token], token)
            .catch(console.error)
    }
}).catch(console.error)