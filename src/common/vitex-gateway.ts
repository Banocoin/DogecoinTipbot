import { join } from "path"
import { cryptoInfoPath } from "./crypto-info"
import {promises as fs} from "fs"
import fetch from "node-fetch"

export type GatewayToken = {
    mappedSymbol: string,
    mappedNet: string,
    mappedTokenId: string,
    url: string,
    extraStandards?: Omit<GatewayToken, "extraStandards">[]
}
export type Gateway = {
    name: string,
    policy: string,
    overview: string,
    support: string,
    serviceSupport: string,
    tokens: {
        [tokenId: string]: GatewayToken
    }
}
export let gateways = {}
// NEVER call that outside of wallet.
export async function indexGateways(){
    const path = join(cryptoInfoPath, "gateways")
    const files = await fs.readdir(path, {withFileTypes: true})
    gateways = {}
    for(const file of files){
        if(!file.isDirectory())continue
        try{
            const jsonFilePath = join(path, file.name, file.name+".json")
            const json = JSON.parse(await fs.readFile(jsonFilePath, "utf8"))
            const gateway = {
                name: json.name,
                policy: json.policy.en,
                overview: json.overview.en,
                support: json.support,
                serviceSupport: json.serviceSupport,
                tokens: json.gatewayTokens
            }
            for(const tokenId in json.gatewayTokens){
                gateways[tokenId] = gateway
            }
        }catch{}
    }
}

export async function getMetaInfo(baseUrl:string, tokenId: string){
    const url = `${baseUrl}/meta-info?tokenId=${tokenId}`
    const res = await fetch(url, {
        headers: {
            version: "v1.0",
            "User-Agent": "VitaBot/1.0.0",
            "Content-Type": "application/json; charset=utf-8",
            lang: "en"
        }
    })
    const json = await res.json()
    if(json.code !== 0){
        throw new Error(`${json.code} ${json.msg}`)
    }
    return json
}

export async function getDepositInfo(baseUrl:string, tokenId:string, address:string){
    const url = `${baseUrl}/deposit-info?tokenId=${tokenId}&walletAddress=${address}`
    const res = await fetch(url, {
        headers: {
            version: "v1.0",
            "User-Agent": "VitaBot/1.0.0",
            "Content-Type": "application/json; charset=utf-8",
            lang: "en"
        }
    })
    const json = await res.json()
    if(json.code !== 0){
        throw new Error(`${json.code} ${json.msg}`)
    }
    return json
}