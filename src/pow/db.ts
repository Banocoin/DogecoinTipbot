import { randomBytes } from "crypto"
import { Txn, Env } from "node-lmdb"
import { join } from "path"
import * as fs from "fs"

export const dataPath = join(__dirname, "../../vpow_data")
if(!fs.existsSync(dataPath))fs.mkdirSync(dataPath)

export const env = new Env()
env.open({
    path: dataPath,
    mapSize: 2*1024*1024*1024*1024,
    maxDbs: 20
})

export enum VPoWPlans {
    FREE,
    DEVELOPER,
    PREMIUM,
    FREN
}
export interface Authentication {
    name: string,
    token: string,
    plan: VPoWPlans,
    ips: AuthenticationIp[],
    allowed_ip_bypass: boolean
}
export interface AuthenticationIp {
    ip: string,
    name: string
}
export const authDB = env.openDbi({
    create: true,
    name: "auth"
})
export function createAuthentication(txn:Txn, authentication: Authentication){
    txn.putString(authDB, authentication.token, authentication.name)
    txn.putString(authDB, authentication.name, JSON.stringify(authentication))
}
export function getAuthenticationByToken(txn:Txn, token:string):Authentication{
    const name = txn.getString(authDB, token)
    if(!name)return null

    return JSON.parse(txn.getString(authDB, name))
}

const txn = env.beginTxn()
const token = randomBytes(32).toString("hex")
createAuthentication(txn, {
    name: "ExperimentDAO",
    token: token,
    plan: VPoWPlans.FREN,
    ips: [],
    allowed_ip_bypass: true
})
console.log(token)
txn.commit()
