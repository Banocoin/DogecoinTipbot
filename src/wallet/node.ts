import WS_RPC from "@vite/vitejs-ws";
import * as vite from "@vite/vitejs";
import { onNewAccountBlock } from "./receive";
import BigNumber from "bignumber.js"
import { getCurrentCycle } from "./cycle";
import { IAddress } from "../models/Address";
import { send } from "./send";
import { waitPow } from "./powqueue";
import { wait } from "../common/util";

export const availableNodes = [
    ...new Set([
        process.env.VITE_WS,
        "wss://node-vite.thomiz.dev/ws",
        "wss://node.vite.net/ws"
    ])
]

export const tokenIds = {
    // did you know it was pronounced veet ?
    VITE: "tti_5649544520544f4b454e6e40",
    ATTOV: "tti_5649544520544f4b454e6e40",
    // The healthiest one
    VITC: "tti_22d0b205bed4d268a05dfc3c",
    // 🍌🍌
    BAN: "tti_f9bd6782f966f899d74d7df8",
    // fast and feeless too
    NANO: "tti_29a2af20212b985e9d49e899",
    NYANO: "tti_29a2af20212b985e9d49e899",
    // ew
    BTC: "tti_b90c9baffffc9dae58d1f33f",
    SATS: "tti_b90c9baffffc9dae58d1f33f",
    // what's the purpose of that one ?
    VX: "tti_564954455820434f494e69b5",
    // redeem merch I guess
    VCP: "tti_251a3e67a41b5ea2373936c8",
    XMR: "tti_e5750d3c5b3bb5a31b8ba637",
    // everything vite does, but with fees
    ETH: "tti_687d8a93915393b219212c73",
    VINU: "tti_541b25bd5e5db35166864096",
    UST: "tti_3d482aaceb076a729cb3967b",
    LUNA: "tti_60ce61fb1bf38a32be3bfb91",
    NYA: "tti_14559f510fa839880af467d1",
    KNOBSACK: "tti_93939ea53d7726c1c0ee0196"
}
export const tokenTickers = {
    [tokenIds.VITE]: "VITE",
    [tokenIds.VITC]: "VITC",
    [tokenIds.BAN]: "BAN",
    [tokenIds.NANO]: "NANO",
    [tokenIds.BTC]: "BTC",
    [tokenIds.VX]: "VX",
    [tokenIds.VCP]: "VCP",
    [tokenIds.XMR]: "XMR",
    [tokenIds.ETH]: "ETH",
    [tokenIds.VINU]: "VINU",
    [tokenIds.UST]: "UST",
    [tokenIds.LUNA]: "LUNA",
    [tokenIds.NYA]: "NYA",
    [tokenIds.KNOBSACK]: "KNOBSACK"
}

export const tokenDecimals = {
    VITE: 18,
    ATTOV: 0,
    VITC: 18,
    BAN: 29,
    NANO: 30,
    NYANO: 24,
    BTC: 8,
    SATS: 0,
    VX: 18,
    VCP: 0,
    XMR: 12,
    ETH: 18,
    VINU: 18,
    UST: 6,
    LUNA: 6,
    NYA: 18,
    KNOBSACK: 0
}

export const tokenNames = {
    VITE: "Vite",
    ATTOV: "Attov",
    VITC: "Vitamin Coin",
    BAN: "Banano",
    NANO: "Nano",
    NYANO: "Nyano",
    SATS: "Satoshi",
    BUS: "Bussycoin",
    XRB: "RayBlocks",
    BANG: "Banano Gold",
    BROCC: "Broccoli 🥦",
    "VINU-000": "Vita Inu [old]",
    MESH: "Mesh",
    VITOGE: "Vitoge",
    VICAT: "ViCat",
    VIVA: "Viva",
    UST: "UST",
    LUNA: "Luna",
    "NYA-000": "Nyanold",
    KNOBSACK: "Bag Of Dicks"
}

export let wsProvider
let lastNode

export function getLastUsedNode(){
    return lastNode
}

export async function init(){
    lastNode = availableNodes[0]
    console.info("[VITE] Connecting to "+availableNodes[0])
    // TODO: Do our own library, because vitejs isn't good.
    const wsService = new WS_RPC(availableNodes[0], 6e4, {
        protocol: "",
        headers: "",
        clientConfig: "",
        retryTimes: Infinity,
        retryInterval: 10000
    })
    await new Promise((resolve) => {
        wsProvider = new vite.ViteAPI(wsService, resolve)
    })
    console.log("[VITE] Connected to node")
    await registerEvents()
    
    wsProvider._provider.on("connect", registerEvents)
}

let resolveTokens:()=>void
export const tokenPromise = new Promise<void>((resolve) => {
    resolveTokens = resolve
})

async function registerEvents(){
    await Promise.all([
        wsProvider.subscribe("createAccountBlockSubscription")
        .then(AccountBlockEvent => {
            AccountBlockEvent.on(async (result) => {
                try{
                    await onNewAccountBlock(result[0].hash)
                }catch(err){
                    console.error(err)
                }
            })
        }),
        (async () => {
            try{
                let page = 0
                const pageSize = 100
                let tokens = []
                // eslint-disable-next-line no-constant-condition
                while(true){
                    const tokensInfo = await wsProvider.request("contract_getTokenInfoList", page, pageSize)
                    page++
                    tokens.push(...tokensInfo.tokenInfoList)
                    if(tokensInfo.tokenInfoList.length != pageSize)break
                }
                tokens = tokens.sort((a, b) => a.index-b.index)
                for(const token of tokens){
                    const symbol = `${token.tokenSymbol}-${"0".repeat(3-token.index.toString().length)+token.index}`
                    tokenNames[symbol] = token.tokenName
                    if(!tokenNames[token.tokenSymbol]){
                        tokenNames[token.tokenSymbol] = token.tokenName
                    }
                    if(!tokenIds[token.tokenSymbol]){
                        tokenIds[token.tokenSymbol] = token.tokenId
                        tokenDecimals[token.tokenSymbol] = token.decimals
                        if(!tokenTickers[token.tokenId]){
                            tokenTickers[token.tokenId] = token.tokenSymbol
                        }
                    }else{
                        if(!tokenTickers[token.tokenId]){
                            tokenTickers[token.tokenId] = symbol
                        }
                    }
                    if(tokenIds[token.tokenSymbol] === token.tokenId){
                        tokenNames[symbol] = token.tokenName
                    }
                    tokenDecimals[symbol] = token.decimals
                    tokenIds[symbol] = token.tokenId
                }
            }catch(err){
                // can't do anything better than report in console.
                console.error(err)
            }
            resolveTokens()
        })()
    ])
}

export async function fetchAccountBlocks(address:string, hash:string, tokenId:string, limit:number){
    return wsProvider.request("ledger_getAccountBlocks", address, hash, tokenId, limit)
}

export async function fetchAccountBlock(hash:string){
    return wsProvider.request("ledger_getAccountBlockByHash", hash)
}

export async function getVotedSBP(address:string):Promise<{
    blockProducerName: string,
    status: number,
    votes: {
        [address: string]: string
    }
}>{
    return wsProvider.request("contract_getVotedSBP", address)
}

export async function getSBPRewardsPendingWithdrawal(sbp:string):Promise<{
    blockProducingReward: string,
    votingReward: string,
    totalReward: string,
    producedBlocks: string,
    targetBlocks: string,
    allRewardWithdrawed: boolean
}>{
    return wsProvider.request("contract_getSBPRewardPendingWithdrawal", sbp)
}

export async function changeSBP(address:IAddress, name: string){
    const keyPair = vite.wallet.deriveKeyPairByIndex(address.seed, 0)
    
    const accountBlock = vite.accountBlock.createAccountBlock("voteForSBP", {
        address: address.address,
        sbpName: name
    })
    accountBlock.setPrivateKey(keyPair.privateKey)
    await sendTX(address.address, accountBlock)
}
export async function burn(address:IAddress, amount: string, tokenId: string){
    const keyPair = vite.wallet.deriveKeyPairByIndex(address.seed, 0)
    
    const tokenInfo = await wsProvider.request("contract_getTokenInfoById", tokenId)
    if(!tokenInfo.isOwnerBurnOnly || address.address === tokenInfo.owner){
        const accountBlock = vite.accountBlock.createAccountBlock("burnToken", {
            address: address.address,
            tokenId,
            amount
        })
        accountBlock.setPrivateKey(keyPair.privateKey)
        return sendTX(address.address, accountBlock)
        .then(hash => ({
            type: "send" as const,
            from: address.address,
            to: vite.constant.TokenIssuance_ContractAddress,
            hash: hash,
            amount: amount,
            token_id: tokenId,
            sender_handle: address.handles[0]
        }))
    }else{
        // send to the burn zero address
        return send(
            address,
            // burn address
            "vite_0000000000000000000000000000000000000000a4f3a0cb58",
            amount,
            tokenId
        )
    }
}

export async function getVotes(name:string, cycle:number = getCurrentCycle()):Promise<{
    total: string,
    votes: {
        [address:string]: string
    },
    name: string
}>{
    const list = await wsProvider.request("contract_getSBPVoteDetailsByCycle", ""+cycle)
    const sbp = list.find(item => item.blockProducerName === name)
    return {
        total: sbp?.totalVotes || "0",
        votes: sbp?.addressVoteMap || {},
        name: sbp?.blockProducerName || name
    }
}

export async function getBalances(address:string):Promise<{
    [tokenId: string]: string
}>{
    const result = await wsProvider.request("ledger_getAccountInfoByAddress", address)

    const balances:{
        [tokenId: string]: string
    } = {}
    for(const tokenId in result.balanceInfoMap||{}){
        balances[tokenId] = result.balanceInfoMap[tokenId].balance
    }
    return balances
}

export const cachedPreviousBlocks = new Map<string, {
    height: number,
    previousHash: string,
    timeout: NodeJS.Timeout
}>()
let botBlocks = []
export async function sendTX(address:string, accountBlock:any):Promise<string>{
    accountBlock.setProvider(wsProvider)

    const [
        quota,
        difficulty
    ] = await Promise.all([
        wsProvider.request("contract_getQuotaByAccount", address),
        (async () => {
            if(cachedPreviousBlocks.has(address)){
                const block = cachedPreviousBlocks.get(address)
                accountBlock.setHeight((block.height).toString())
                accountBlock.setPreviousHash(block.previousHash)
            }else{
                await accountBlock.autoSetPreviousAccountBlock()
                const block = {
                    timeout: null,
                    height: parseInt(accountBlock.height),
                    previousHash: accountBlock.previousHash
                }
                cachedPreviousBlocks.set(address, block)
            }
        })()
        .then(async () => {
            let i = 0;
            let error = null
            while(i < 3){
                try{
                    return await wsProvider.request("ledger_getPoWDifficulty", {
                        address: accountBlock.address,
                        previousHash: accountBlock.previousHash,
                        blockType: accountBlock.blockType,
                        toAddress: accountBlock.toAddress,
                        data: accountBlock.data
                    })
                }catch(err){
                    error = err
                    if(err?.error?.code === -35005){
                        if(i !== 2)await wait(1500)
                        i++
                    }else{
                        throw err
                    }
                }
            }
            throw error
        }) as Promise<{
            requiredQuota: string;
            difficulty: string;
            qc: string;
            isCongestion: boolean;
        }>
    ])
    const availableQuota = new BigNumber(quota.currentQuota)
    if(availableQuota.isLessThan(difficulty.requiredQuota)){
        await waitPow(() => accountBlock.PoW(difficulty.difficulty))
    }
    await accountBlock.sign()
    
    let hash
    const isQuotaAddress = address === "vite_178bc3256ac2b30cc923cd0c5f138e79b8b7257e43f69606f3"
    try{
        const block = await accountBlock.send()
        hash = block.hash
        if(isQuotaAddress){
            botBlocks.push(block)
        }
    }catch(err){
        if(err?.error?.code === -35005){
            // calc PoW twice referring to one snapshot block
            let i = 3
            while(i > 0){
                await wait(2000)
                try{
                    const block = await accountBlock.send()
                    hash = block.hash
                    break
                }catch(e){
                    // eslint-disable-next-line no-ex-assign
                    err = e
                    i--
                }
            }
        }
        if(isQuotaAddress){
            console.error(JSON.stringify(botBlocks), err)
            botBlocks = []
        }
        throw err
    }
    const pblock = cachedPreviousBlocks.get(address) || {} as any
    pblock.height++
    pblock.previousHash = hash
    const timeout = pblock.timeout = setTimeout(() => {
        const block = cachedPreviousBlocks.get(address)
        if(timeout !== block.timeout)return
        cachedPreviousBlocks.delete(address)
    }, 600000)
    cachedPreviousBlocks.set(address, pblock)

    return hash
}