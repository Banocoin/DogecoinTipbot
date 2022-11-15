// Get VITCSwap conversion for amount, token0 and token1

import BigNumber from "bignumber.js"
import Address from "../../models/Address"
import { AmountError, BalanceError } from "../errors"
import { getBalances } from "../node"
import { send } from "../send"
import { AddressValidator, AmountValidator, TokenIdValidator } from "../types"
import { VITCSWAP_ADDRESS } from "../vitcswap"
import viteQueue from "../viteQueue"
import * as vite from "@vite/vitejs"

export default async function doSwapVITCSwap(from:string, amount:string, token0:string, token1:string, minimum:string, recipient:string){
    await AddressValidator.validateAsync(from)
    await AmountValidator.validateAsync(amount)
    await TokenIdValidator.validateAsync(token0)
    await TokenIdValidator.validateAsync(token1)
    await AmountValidator.validateAsync(minimum)
    await AddressValidator.validateAsync(recipient)

    const address = await Address.findOne({
        address: from
    })

    if(!address)throw new Error("from address not found.")

    const tx = await viteQueue.queueAction(from, async () => {
        const balances = await getBalances(from)
        const balance = new BigNumber(balances[token0] || 0)
        const amountRaw = new BigNumber(amount)
        if(amountRaw.isEqualTo(0)){
            throw new AmountError("Amount is 0")
        }
        if(balance.isLessThan(amountRaw)){
            throw new BalanceError("Insufficient balance")
        }

        return send(
            address,
            VITCSWAP_ADDRESS,
            amount,
            token0,
            Buffer.from(
                [
                    vite.abi.encodeFunctionSignature("swap(address,tokenId,uint256)"),
                    vite.abi.encodeParameters(
                        ["address","tokenId","uint256"],
                        [recipient, token1, minimum]
                    )
                ].join(""),
                "hex"
            ).toString("base64")
        )
    })

    return tx
}