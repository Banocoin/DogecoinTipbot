// This file will periodically fetch vitelabs/crypto-info on github, and place it in ./crypto-info

import {existsSync} from "fs"
import { join } from "path";
import { cloneRepo, gitQueue, pullRepo } from "./git";
import { indexGateways } from "./vitex-gateway";

export const repoUrl = "https://github.com/vitelabs/crypto-info"
export const cryptoInfoPath = join(__dirname, "../../crypto-info")

;(async () => {
    if(existsSync(cryptoInfoPath)){
        // pull
        await gitQueue.queueAction(cryptoInfoPath, async () => {
            await pullRepo(cryptoInfoPath)
        })
    }else{
        // clone
        await gitQueue.queueAction(cryptoInfoPath, async () => {
            await cloneRepo(repoUrl, cryptoInfoPath)
        })
    }
    await indexGateways()
    // pog it worked
    setInterval(() => {
        pullRepo(cryptoInfoPath)
        .then(indexGateways)
    }, 30*60*1000)
})()