import "../common/load-env";
import { dbPromise } from "../common/load-db";
import { init } from "./node";
import initStuckTransactionService from "./stuckTransactions";
import "../common/crypto-info"

(async () => {
    console.log("Starting Wallet !")

    // First, connect to the database and node.
    await Promise.all([
        dbPromise,
        init()
    ])

    import("./server")

    initStuckTransactionService()
})()