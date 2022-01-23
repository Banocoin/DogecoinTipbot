import { json, Router } from "express";
import ActionQueue from "../../common/queue";
import Address, { IAddress } from "../../models/Address";
import * as vite from "@vite/vitejs"
import { parseTransactionType } from "../../wallet/address";
import { discordClient, twitc } from "..";
import TelegramUsername from "../../models/TelegramUsername";

const addressQueue = new ActionQueue<string>()
const cache = {}

export default Router()
.post(
    "/lookup",
    json(),
    async (req, res) => {
        const body = req.body
        if(
            !Array.isArray(body) || 
            body.find(e => typeof e !== "string" || !vite.wallet.isValidAddress(e))
        )return res.status(400).send({
            error: {
                name: "BodyError",
                message: "Couldn't correctly parse the body. Please make sure you set the Content-Type header and that you pass an array of addresses."
            }
        })
        if(body.length > 50){
            return res.status(400).send({
                error: {
                    name: "BadRequestError",
                    message: "Too many addresses to check. Maximum is 50"
                }
            })
        }
        let resolveEnd
        const endPromise = new Promise((resolve) => {
            resolveEnd = resolve
        })
        const promises = [] 
        const addressesToCheck = []
        const result = {}
        for(const address of body){
            let resolveStart
            const startPromise = new Promise((resolve) => {
                resolveStart = resolve
            })
            promises.push(startPromise)
            addressQueue.queueAction(address, async () => {
                const shouldFetch = !(address in cache)
                if(shouldFetch)addressesToCheck.push(address)
                resolveStart()

                result[address] = null
                if(!shouldFetch)return result[address] = cache[address]
                // wait for fetching to finish before freeing queue
                await endPromise
            })
        }
        await Promise.all(promises)
        if(!addressesToCheck.length){
            resolveEnd()
    
            res.status(200).send(result)
            return
        }
        const addresses:IAddress[] = await Address.find({
            $or: addressesToCheck.map(address => {
                return {
                    address: address
                }
            })
        }).exec()

        for(const address of addresses){
            const handle = address.handles[0]
            const parsed = await parseTransactionType(handle, null)
            let name = null
            switch(parsed.type){
                case "giveaway":{
                    name = "VitaBot Discord Giveaway"
                    break
                }
                case "airdrop":{
                    name = "VitaBot Discord Airdrop"
                    break
                }
                case "faucet":{
                    name = "Vitamin Coin Discord Faucet Channel"
                    break
                }
                case "tip":{
                    switch(parsed.platform){
                        case "Discord": {
                            const user = await discordClient.users.fetch(parsed.id).catch(()=>null)
                            name = user?.tag ? `${user.tag} (Discord)` : "Unknown Discord Tipbot"
                            break
                        }
                        case "Twitter": {
                            const user = await twitc.v2.user(parsed.id).catch(() => null)
                            name = user?.data ? `@${user.data.username} (Twitter)` : "Unknown Twitter Tipbot"
                            break
                        }
                        case "Telegram": {
                            const user = await TelegramUsername.findOne({
                                user_id: parseInt(parsed.id)
                            })
                            if(user?.username){
                                name = `@${user.username} (Telegram)`
                            }else{
                                name = `${parsed.id} (Telegram)`
                            }
                            break
                        }
                        default: {
                            name = `${parsed.id}:${parsed.platform}`
                        }
                    }
                    break
                }
                case "rewards": {
                    name = "VitaminCoinSBP Distribution Address"
                    break
                }
                case "claim.rewards": {
                    name = "VitaminCoinSBP Claim Address"
                    break
                }
                case "rewards.vitoge": {
                    name = "Vitoge_SBP Distribution Address"
                    break
                }
                case "claim.rewards.vitoge": {
                    name = "Vitoge_SBP Claim Address"
                    break
                }
                case "mods.rewards": {
                    name = "Vitamin Coin Mods Weekly Salary Distribution Address"
                    break
                }
                case "dao.rewards": {
                    name = "Vitamin Coin DAO Distribution Address"
                    break
                }
                case "unknown": {
                    name = "VitaBot Quota Accelerator"
                    break
                }
                default:
                    name = "Unrecognised VitaBot Address"
            }
            cache[address.address] = result[address.address] = name
        }

        resolveEnd()

        res.status(200).send(result)
    }
)