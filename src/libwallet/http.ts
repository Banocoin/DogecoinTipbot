import fetch from "node-fetch"
import { Gateway } from "../common/vitex-gateway"
import { ReceiveTransaction, SendTransaction } from "../wallet/events"

export type GetTokenResponse = {
    token_ids: {
        [ticker:string]: string
    },
    token_names: {
        [ticker:string]: string
    },
    token_tickers: {
        [token_id:string]: string
    },
    token_decimals: {
        [ticker:string]: string
    }
}

export type BulkSendResponse = [
    [
        SendTransaction,
        ReceiveTransaction
    ],
    SendTransaction[]
]

export type GetBalancesResponses = {
    [tokenId: string]: string
}

export type SendResponse = SendTransaction

export type SendWaitResponse = [SendTransaction, ReceiveTransaction]

export type GetAccountBlockResponse = any
export type GetAccountBlocksResponse = GetAccountBlockResponse[]

export type GetSBPVotesResponse = {
    blockProducerName: string,
    status: string,
    votes: {
        [address: string]: string
    }
}

export type GetSBPRewardsPendingWithdrawalResponse = {
    blockProducingReward: string,
    votingReward: string,
    totalReward: string,
    producedBlocks: string,
    targetBlocks: string,
    allRewardWithdrawed: boolean
}

export interface WalletResponses {
    bulk_send: BulkSendResponse,
    get_balances: GetBalancesResponses,
    get_tokens: GetTokenResponse,
    send: SendResponse,
    burn: SendResponse,
    send_wait_receive: SendWaitResponse,
    get_account_block: GetAccountBlockResponse,
    get_account_blocks: GetAccountBlocksResponse,
    get_sbp_votes: GetSBPVotesResponse,
    get_vitcswap_pairs: string[],
    get_vitcswap_conversion: string,
    do_swap_vitcswap: SendResponse,
    get_sbp_rewards_pending_withdrawal: GetSBPRewardsPendingWithdrawalResponse,
    withdraw_sbp_rewards: SendResponse,
    get_gateways: {
        [tokenId: string]: Gateway
    },
    restart: null,
    process_account: null,
    resolve_vitens: string
}

export interface WalletRequestParams {
    bulk_send: [from:string, payouts:[to:string, amount:string][], tokenId:string, quotaTimeout?:number],
    get_balances: [address:string],
    get_tokens: [],
    send: [from:string, to:string, amount:string, tokenId:string],
    burn: [from:string, amount:string, tokenId:string],
    get_account_block: [hash:string],
    get_account_blocks: [address:string, hash:string, tokenId:string, limit:number],
    get_sbp_votes: [name:string, cycle?:number],
    get_sbp_rewards_pending_withdrawal: [sbpName:string],
    withdraw_sbp_rewards: [from:string, to:string, sbpName:string],
    send_wait_receive: [from:string, to:string, amount:string, tokenId:string],
    get_gateways: [],
    get_vitcswap_pairs: [],
    get_vitcswap_conversion: [amount:string, token0:string, token1:string],
    do_swap_vitcswap: [from:string, amount:string, token0:string, token1:string, minimum:string, recipient:string]
    restart: [],
    process_account: [address:string],
    resolve_vitens: [name:string]
}

export async function requestWallet<Action extends keyof WalletResponses>(action:Action, ...params: WalletRequestParams[Action]):Promise<WalletResponses[Action]>{
    const res = await fetch("http://127.0.0.1:"+process.env.WALLET_PORT, {
        headers: {
            Authorization: process.env.WALLET_API_KEY
        },
        method: "post",
        body: JSON.stringify({
            action,
            params
        })
    })
    const body = await res.json()
    if(typeof body === "object" && body && "error" in body){
        const err = Error()
        err.message = body.error.message
        err.name = body.error.name
        throw err
    }
    return body
}