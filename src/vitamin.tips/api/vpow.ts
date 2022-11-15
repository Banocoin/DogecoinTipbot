import { Router } from "express";
import * as vite from "@vite/vitejs"
import VPoWPayout from "../../models/VPoWPayout";
import BigNumber from "bignumber.js";

const payout = ["0.5", "VITC"]

export default Router()
.get("/pending_balance/:address", async (req, res) => {
    const address = req.params.address
    if(!vite.wallet.isValidAddress(address)){
        res.status(400).send({
            error: {
                name: "AddressError",
                message: "Invalid address"
            }
        })
        return
    }
    const count = await VPoWPayout.countDocuments({
        address: address
    })

    res.status(200).send({
        balance: [
            new BigNumber(count).times(payout[0]).toFixed(),
            payout[1]
        ]
    })
})