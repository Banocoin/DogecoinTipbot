import { Router } from "express";
import * as vite from "@vite/vitejs"
import { requestWallet } from "../../libwallet/http";
import BigNumber from "bignumber.js";

export default Router()
.get("/balance/:address", async (req, res) => {
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
    const [
        tokens,
        balance
    ] = await Promise.all([
        await requestWallet("get_tokens"),
        await requestWallet("get_balances", address)
    ])
    return res.status(200).send(Object.fromEntries(Object.entries(balance).map(([k, v]) => {
        const ticker = tokens.token_tickers[k] || null
        const decimals = ticker ? tokens.token_decimals[ticker] || 0 : 0
        return [k, new BigNumber(v as string).shiftedBy(-decimals).toFixed()]
    })))
})