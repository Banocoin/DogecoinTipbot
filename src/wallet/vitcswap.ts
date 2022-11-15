import { wsProvider } from "./node";
import * as vite from "@vite/vitejs"

export const VITCSWAP_ADDRESS = "vite_29ae0b9f951323b3bfe9bb8251bba2830eddacf51631630495"

export async function getPairs(){
    const events = await wsProvider.request(
        "ledger_getVmLogsByFilter",
        {
            addressHeightRange: {
                [VITCSWAP_ADDRESS]: {
                    fromHeight: "1",
                    toHeight: "0"
                }
            },
            topics: [
                [vite.abi.encodeLogSignature(`NewPair(tokenId)`)]
            ]
        }
    )
    return (events || []).map(event => {
        const raw_token = event.vmlog.topics[1]
        return vite.abi.decodeParameter("tokenId", raw_token)
    })
}

export async function getConversion(amount:string, token0:string, token1:string){
    const result = await wsProvider.request(
        "contract_query",
        {
            address: VITCSWAP_ADDRESS,
            data: Buffer.from(
                vite.abi.encodeFunctionSignature(`getConversion(tokenId,tokenId,uint256)`) +
                vite.abi.encodeParameters(
                    ["tokenId", "tokenId", "uint256"],
                    [token0, token1, amount]
                ),
                "hex"
            ).toString("base64")
        }
    )
    const decoded = vite.abi.decodeParameters(
        ["uint256"],
        Buffer.from(result, "base64").toString("hex")
    )
    return decoded[0]
}