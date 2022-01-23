// this file i separate from the wallet system, i just didn't want to create another repository
import "../common/load-env"

const startDates = [
    new Date("2021-11-26T05:00:00.000Z"),
    new Date("2021-11-26T05:00:00.000Z"),
    new Date("2021-11-26T05:00:00.000Z"),
    new Date("2021-11-26T05:00:00.000Z"),
    new Date("2021-11-26T05:00:00.000Z"),
    new Date("2021-11-26T05:00:00.000Z"),
    new Date("2021-11-26T05:00:00.000Z"),
    new Date("2021-11-26T05:00:00.000Z"),
    new Date("2021-11-26T05:00:00.000Z"),
    new Date("2021-12-17T05:00:00.000Z")
]

// that's all i could gather
const sbpList = [
    "VitaminCoinSBP",
    "ViNo_Community_Node",
    "SwissVite.org",
    "vite.bi23",
    "InfStones",
    "N4Y",
    "N4Q.org",
    "Elegance.Vite",
    "Beauty.Vite",
    "Vitoge_SBP"
]
const sbpsIcon = [
    "https://cdn.discordapp.com/attachments/913843385067008023/913853269753856020/Vitc_Icon_Dark_Tilt_.png",
    "https://cdn.discordapp.com/attachments/913843385067008023/913853948115451954/a_a323ef08576cd632cb4db0aee1bde7c9.png",
    "https://cdn.discordapp.com/attachments/913843385067008023/913854499653824582/swissvitelogo-1-e1542373452984_1.png",
    "https://cdn.discordapp.com/attachments/913843385067008023/913863459068846111/bi23news.png",
    "https://cdn.discordapp.com/attachments/913843385067008023/913865536792821770/infstones.png",
    null,
    null,
    null,
    null,
    null
]

import * as vite from "@vite/vitejs"
import WS_RPC from "@vite/vitejs-ws";
import BigNumber from "bignumber.js";
import viteQueue from "../cryptocurrencies/viteQueue";
import { AddressObj } from "@vite/vitejs/distSrc/wallet/type";
import { ReceiveTransaction } from "../wallet/events";
import * as Discord from "discord.js"
import { VITC_COLOR } from "../common/constants";
import { tokenPrices } from "../common/price";
import { durationUnits } from "../common/util"
import fetch from "node-fetch"
const wallet = vite.wallet.getWallet(process.env.VOTING_MNEMONIC)
const webhook = new Discord.WebhookClient({
    url: process.env.VOTING_WEBHOOK
})

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
    VINU: "tti_541b25bd5e5db35166864096"
}
export const tokenTickers = {
    tti_5649544520544f4b454e6e40: "VITE",
    tti_22d0b205bed4d268a05dfc3c: "VITC",
    tti_f9bd6782f966f899d74d7df8: "BAN",
    tti_29a2af20212b985e9d49e899: "NANO",
    tti_b90c9baffffc9dae58d1f33f: "BTC",
    tti_564954455820434f494e69b5: "VX",
    tti_251a3e67a41b5ea2373936c8: "VCP",
    tti_e5750d3c5b3bb5a31b8ba637: "XMR",
    tti_687d8a93915393b219212c73: "ETH",
    tti_541b25bd5e5db35166864096: "VINU"
}

export const tokenDecimals = {
    VITE: 18,
    ATTOV: 0,
    VITC: 18,
    BAN: 29,
    NANO: 30,
    NYANO: 21,
    BTC: 8,
    SATS: 0,
    VX: 18,
    VCP: 0,
    XMR: 12,
    ETH: 18,
    VINU: 18
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
    BROCC: "Broccoli 🥦"
}

export const sbpsAddresses = {}
for(let i = 0;i < sbpList.length;i++){
    const sbp = sbpList[i]
    const address = wallet.deriveAddress(i)
    sbpsAddresses[address.address] = sbp
}

async function broadcastMessage(tx:ReceiveTransaction){
    const index = sbpList.indexOf(sbpsAddresses[tx.to])
    const balances = await getBalances(tx.to)
    const startViteValue = new BigNumber(100)
    let totalViteValue = new BigNumber(0)
    for(const tokenId in balances){
        const pair = tokenPrices[tokenId+"/"+tokenIds.VITE]

        const viteValue = new BigNumber(pair?.closePrice || 0)
        .times(convert(balances[tokenId], "RAW", "VITE"))

        totalViteValue = totalViteValue.plus(viteValue)
    }
    const percent = totalViteValue.div(startViteValue)
        .minus(1).times(100)
    const startDate = startDates[index]
    const elapsedDays = Math.floor((Date.now()-startDate.getTime())/durationUnits.d)
    await webhook.send({
        content: `Transaction received!`,
        embeds: [
            new Discord.MessageEmbed()
            .setColor(VITC_COLOR)
            .setDescription(`SBP Payout received!

Received: **${convert(tx.amount, "RAW", tokenTickers[tx.token_id])}** ${tokenNames[tokenTickers[tx.token_id]]}
Total Vite Equivalent: **${convert(totalViteValue.toFixed(6), "VITE", "VITE")}** VITE (**${percent.toFixed(2)}%**)
SBP: **[${sbpsAddresses[tx.to]}](https://vitescan.io/sbp/${sbpsAddresses[tx.to]})**
From: [${tx.from}](https://vitescan.io/address/${tx.from})
Hash: [${tx.hash}](https://vitescan.io/tx/${tx.hash})
Time: <t:${Math.floor(Date.now()/1000)}>
Daily: **${percent.div(elapsedDays).toFixed(2)}%**
Yearly: **${percent.times(365).div(elapsedDays).toFixed(2)}%**
`)
        ],
        username: sbpsAddresses[tx.to] || "Unknown SBP",
        avatarURL: sbpsIcon[index]
    })
    await fetch("https://vite-api.thomiz.dev/sbps/"+sbpsAddresses[tx.to]+"/apy", {
        method: "post",
        headers: {
            "Content-Type": "application/json",
            "Authorization": process.env.VOTING_API_KEY
        },
        body: JSON.stringify({
            apy: percent.times(365).div(elapsedDays).toNumber(),
            startDate: startDate.toISOString(),
            trackingAddress: tx.to
        })
    })
}

export let wsProvider
;(async () => {
    console.info("[VITE] Connecting to "+process.env.VITE_WS)
    const wsService = new WS_RPC(process.env.VITE_WS, 6e5, {
        protocol: "",
        headers: "",
        clientConfig: "",
        retryTimes: Infinity,
        retryInterval: 10000
    })
    await new Promise((resolve) => {
        wsProvider = new vite.ViteAPI(wsService, resolve)
    })
    for(const address in sbpsAddresses){
        const voted = await getVotedSBP(address)
        if(voted?.blockProducerName !== sbpsAddresses[address]){
            console.log(`Changing SBP for ${address} from ${voted?.blockProducerName} to ${sbpsAddresses[address]}.`)
            const addressIndex = sbpList.indexOf(sbpsAddresses[address])
            const addr = wallet.deriveAddress(addressIndex)
            await changeSBP(addr, sbpsAddresses[address])
        }
        console.log(`${address}: ${sbpsAddresses[address]}`)
    }
    console.log("[VITE] Connected to node")
    await registerEvents()
    
    wsProvider._provider.on("connect", registerEvents)
})()

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
        })()
    ])
}

async function onNewAccountBlock(hash:string){
    await (async () => {
        const block = await wsProvider.request("ledger_getAccountBlockByHash", hash)
        if(!block)return
        if(![2,3,6].includes(block.blockType))return
        switch(block.toAddress){
            default: {
                if(!sbpsAddresses[block.toAddress])return
                await receive(block)
            }
        }
    })()
}

export async function receive(block: any){
    const sbpName = sbpsAddresses[block.toAddress]
    const addressIndex = sbpList.indexOf(sbpName)
    const address = wallet.deriveAddress(addressIndex)
    console.log(`Receiving ${block.hash} for ${address.address}`)
    const hash = await viteQueue.queueAction(address.address, async () => {
        const accountBlock = vite.accountBlock.createAccountBlock("receive", {
            address: address.address,
            sendBlockHash: block.hash
        })
        accountBlock.setPrivateKey(address.privateKey)
        return sendTX(address.address, accountBlock)
    })

    await broadcastMessage({
        type: "receive",
        from: block.fromAddress,
        to: block.toAddress,
        hash: hash,
        from_hash: block.hash,
        amount: block.amount,
        token_id: block.tokenInfo.tokenId,
        sender_handle: sbpName
    })
    return hash
}

export async function sendTX(address:string, accountBlock:any):Promise<string>{
    accountBlock.setProvider(wsProvider)

    const [
        quota,
        difficulty
    ] = await Promise.all([
        wsProvider.request("contract_getQuotaByAccount", address),
        (async () => {
            await accountBlock.autoSetPreviousAccountBlock()
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
                        if(i !== 2)await new Promise(r => setTimeout(r, 1500))
                        i++
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
        await accountBlock.PoW(difficulty.difficulty)
    }
    await accountBlock.sign()
    
    const block = await accountBlock.send()
    const hash = block.hash

    return hash
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
export async function changeSBP(address:AddressObj, name: string){
    const accountBlock = vite.accountBlock.createAccountBlock("voteForSBP", {
        address: address.address,
        sbpName: name
    })
    accountBlock.setPrivateKey(address.privateKey)
    await sendTX(address.address, accountBlock)
}
export function convert(amount: string|BigNumber|number, base_unit: string, unit: string){
    const value = new BigNumber(amount)
        .shiftedBy(tokenDecimals[base_unit]||0)
        .shiftedBy(-tokenDecimals[unit]||0)
    let toFixed = value.toFixed(tokenDecimals[unit]||0)

    if(toFixed.includes(".")){
        toFixed = toFixed.replace(/\.?0+$/, "") || "0" 
    }

    return toFixed
}