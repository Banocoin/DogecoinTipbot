// Help support VitaBot by doing pows
import "../common/load-env"
import { dbPromise } from "../common/load-db"
import express from "express"
import { Server } from "http"
import { ExtendedWebsocket, wss } from "./ws"
import Joi from "joi"
import events from "./events"
import { checkPoWNonce } from "./util"
import WebSocket from "ws"
import VPoWPayout from "../models/VPoWPayout"
import lt from "long-timeout"
import { distributeRewards } from "./rewards"
import { durationUnits } from "../common/util"
import { getVITEAddressOrCreateOne } from "../wallet/address"
import { IAddress } from "../models/Address"
import BigNumber from "bignumber.js"

export const payout = ["1", "VITC"]
export const MAX_THRESHOLD = new BigNumber("")

const actionSchema = Joi.object({
    hash: Joi.string().disallow(null).required().regex(/^[\dabcdef]{64}$/),
    threshold: Joi.string().disallow(null).required().regex(/^[\dabcdef]{64}$/)
}).required()

export let VPoWAddress:IAddress

dbPromise.then(async () => {
    VPoWAddress = await getVITEAddressOrCreateOne("VPoW", "Rewards")
    console.log(`VPoW Address: ${VPoWAddress.address}`)

    lt.setTimeout(() => {
        distributeRewards(Date.now())
        
        lt.setInterval(() => distributeRewards(Date.now()), durationUnits.d)
    }, durationUnits.d - Date.now() % durationUnits.d)
    // connected to db
    const app = express()
    .disable("x-powered-by")
    .post(
        "/api/generate_work", 
        (req, res, next) => {
            // only allow localhost to access this service.
            if(!["::ffff:127.0.0.1", "127.0.0.1"].includes(req.ip))return res.status(401).send({
                code: 1,
                data: null,
                msg: "UnauthorizedError",
                error: "Your ip isn't allowed to access this service."
            })
            next()
        },
        (req, res, next) => {
            const buffers = []
            req.on("data", (data) => {
                buffers.push(data)
            })
            req.on("end", () => {
                req.body = Buffer.concat(buffers)
                next()
            })
        },
        (req, res, next) => {
            try{
                req.body = JSON.parse(req.body.toString("utf8"))
                next()
            }catch(err){
                res.status(400).send({
                    code: 2,
                    data: null,
                    msg: err.name,
                    error: err.message
                })
            }
        },
        async (req, res) => {
            try{
                await actionSchema.validateAsync(req.body)
            }catch(err){
                return res.status(400).send({
                    code: 3,
                    data: null,
                    msg: err.name,
                    error: err.message
                })
            }
                
            const body:{
                hash: string,
                threshold: string
            } = req.body
            const thresholdnum = new BigNumber("0x"+body.threshold)
            if(thresholdnum)
            console.log(`[REQ] ${body.hash}:${body.threshold}`)
            
            const data = JSON.stringify({
                action: "work_generate",
                hash: body.hash,
                threshold: body.threshold
            })
            if(!wss.clients.size)return res.status(500).send({
                code: 5,
                data: null,
                error: "No VPoW peers available",
                msg: "PeerError"
            })
            for(const client of wss.clients){
                try{
                    client.send(data)
                }catch{}
            }

            try{
                const nonce = await new Promise<string>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        events.off("response", listener)

                        reject(new Error("Request timed out after 30 seconds."))
                    }, 30*1000)

                    const listener = async (data:{
                        hash: string,
                        nonce: string
                    }, client:WebSocket&ExtendedWebsocket) => {
                        try{
                            if(data.hash !== body.hash)return

                            const isValid = checkPoWNonce(
                                body.threshold,
                                Buffer.from(data.nonce, "hex").reverse(),
                                Buffer.from(body.hash, "hex")
                            )
                            if(!isValid)return

                            // we got the valid answer
                            client.send(JSON.stringify({
                                action: "work_accepted",
                                hash: body.hash,
                                payout: payout
                            }))

                            clearTimeout(timeout)
                            events.off("response", listener)
                            
                            const d = JSON.stringify({
                                action: "work_cancel",
                                hash: body.hash
                            })
                            for(const client of wss.clients){
                                try{
                                    client.send(d)
                                }catch{}
                            }

                            resolve(data.nonce)

                            // add the reward to the database for payment later
                            await VPoWPayout.create({
                                address: client.address,
                                date: new Date(),
                                hash: Buffer.from(body.hash, "hex")
                            })
                        }catch(err){
                            console.error(err)
                        }
                    }
                    events.on("response", listener)

                })

                console.log(`[RES] ${body.hash}:${nonce}`)
                res.status(200).send({
                    code: 0,
                    data: {
                        work: nonce
                    },
                    msg: null,
                    error: null
                })
            }catch(err){
                console.error(err)
                res.status(500).send({
                    code: 4,
                    data: null,
                    msg: err.name,
                    error: err.message
                })
            }
        }
    )

    const server = new Server(app)

    server.on("upgrade", (request, socket, head) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request)
        })
    })
      
    server.listen(3070)
    console.log("Listening on http://127.0.0.1:3070")
})