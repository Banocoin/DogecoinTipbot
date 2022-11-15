import ActionQueue from "../../common/queue";
import express from "express"
import APIProject from "../../models/APIProject";
import { requestWallet } from "../../libwallet/http";
import * as vite from "@vite/vitejs"
import BigNumber from "bignumber.js";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
 
const autherror = {
    error: {
        name: "AuthenticationError",
        message: "Your Authorization header is invalid."
    }
}
const authQueue = new ActionQueue()
const queue = new ActionQueue()
export default express.Router()
.use((req, res, next) => {
    const authorization = req.header("Authorization")
    if(!authorization)return res.status(401).send(autherror)

    authQueue.queueAction(authorization, async () => {
        req.account = await APIProject.findOne({
            key: authorization
        })
        if(!req.account)return res.status(401).send(autherror)
        next()
    })
})
.get("/addresses", (req, res) => {
    res.status(200).send(req.account.addresses)
})
.post("/addresses/new", (req, res) => {
    authQueue.queueAction(req.header("Authorization"), async () => {
        const index = req.account.addresses.length
        const address = await getVITEAddressOrCreateOne(
            `${req.account.project_id}_${index}`,
            "Bank"
        )
        req.account.addresses.push(address.address)
        await req.account.save()
        
        res.status(200).send({
            address: address.address,
            index: index
        })
    })
})
.get("/balances", async (req, res) => {
    let resolve = () => {}
    const promise = new Promise<void>((r) => {
        resolve = r
    })
    let count = req.account.addresses.length
    const balances = await Promise.all(req.account.addresses.map((address, i) => {
        return queue.queueAction(address, async () => {
            count--
            if(count === 0)resolve()
            else await promise

            return {
                address: address,
                index: i,
                balances: await requestWallet("get_balances", address)
            }
        })
    }))
    res.status(200).send(balances)
})
.get("/balances/:index", async (req, res) => {
    let address:string
    if(vite.wallet.isValidAddress(req.params.index)){
        address = req.params.index
    }else{
        const index = Number(req.params.index)
        if(
            isNaN(index) ||
            index < 0 ||
            index >= req.account.addresses.length ||
            Math.floor(index) !== index
        )return res.status(400).send({
            error: {
                name: "BadRequest",
                message: "The address index you specified is invalid."
            }
        })
        address = req.account.addresses[index]
    }

    await queue.queueAction(address, async () => {
        const balances = await requestWallet("get_balances", address)
        res.status(200).send(balances)
    })
})
.post(
    "/send/:index",
    express.json(),
    async (req, res) => {
        let address:string
        if(vite.wallet.isValidAddress(req.params.index)){
            if(!req.account.addresses.includes(req.params.index)){
                return res.status(400).send({
                    error: {
                        name: "AuthenticationError",
                        message: "The from address you specified is invalid."
                    }
                })
            }
            address = req.params.index
        }else{
            const index = Number(req.params.index)
            if(
                isNaN(index) ||
                index < 0 ||
                index >= req.account.addresses.length ||
                Math.floor(index) !== index
            )return res.status(400).send({
                error: {
                    name: "BadRequest",
                    message: "The address index you specified is invalid."
                }
            })
            address = req.account.addresses[index]
        }

        const body:{
            to: string,
            amount: string
            tokenId: string
        } = req.body
        if(
            !vite.wallet.isValidAddress(body.to) ||
            !/^\d+?$/.test(body.amount) ||
            !vite.utils.isValidTokenId(body.tokenId)
        )return res.status(400).send({
            error: {
                name: "BadRequest",
                message: "The transaction you're sending is invalid."
            }
        })

        await queue.queueAction(address, async () => {
            const balances = await requestWallet("get_balances", address)
            const balance = new BigNumber(balances[body.tokenId] || 0)
            if(balance.isLessThan(body.amount))return res.status(400).send({
                error: {
                    name: "BadRequest",
                    message: "Insufficient balance to complete this transaction."
                }
            })

            try{
                const tx = await requestWallet(
                    "send", 
                    address,
                    body.to,
                    body.amount,
                    body.tokenId
                )
                return res.status(200).send(tx)
            }catch(err){
                console.error(err)
                res.status(500).send({
                    error: {
                        name: err?.name || err?.error?.code || err,
                        message: err?.message || err?.error?.message || err
                    }
                })
            }
        })
    }
)