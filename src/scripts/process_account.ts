import "../common/load-env"
import { requestWallet } from "../libwallet/http"

requestWallet("process_account", process.argv[2])
.then(() => {
    console.log(`Account done`)
}).catch(console.error)