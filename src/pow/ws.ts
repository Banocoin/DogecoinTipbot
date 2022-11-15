import WebSocket from "ws"
import * as vite from "@vite/vitejs"
import events from "./events"
import VPoWPayout from "../models/VPoWPayout"
import { payout } from "."
import BigNumber from "bignumber.js"

export interface ExtendedWebsocket {
    address: string
}

export const wss = new WebSocket.Server({
    noServer: true
})

wss.on("connection", (ws:WebSocket&ExtendedWebsocket, req) => {
    const url = new URL("http://e.e"+req.url)
    const address = url.searchParams.get("address")
    if(!address || !vite.wallet.isValidAddress(address))return ws.terminate()
    ws.address = address

    console.log(`[CON]: ${address},${req.connection.remoteAddress},${req.headers["x-forwarded-for"]}`)

    const createPingTimeout = () => setTimeout(() => {
        ws.send(JSON.stringify({
            action: "ping",
            timestamp: Date.now()
        }))
        pingTimeout = setTimeout(() => {
            ws.close(1000)
        }, 15*1000)
    }, 30*1000)
    let pingTimeout = createPingTimeout()
    ws.on("message", data => {
        try{
            const msg = JSON.parse(String(data))
            if(typeof msg !== "object" || !("action" in msg))return ws.close(1000, "Bad Message")
            switch(msg.action){
                case "pong": {
                    clearTimeout(pingTimeout)
                    pingTimeout = createPingTimeout()
                    break
                }
                case "response": {
                    if(typeof msg.hash !== "string" || !/^[\dabcdef]{64}$/.test(msg.hash))return ws.close(1000, "Bad Message")
                    if(typeof msg.nonce !== "string" || !/^[\dabcdef]{16}$/.test(msg.nonce))return ws.close(1000, "Bad Message")
                    events.emit("response", {
                        hash: msg.hash,
                        nonce: msg.nonce
                    }, ws)
                    break
                }
                case "pending_balance": {
                    // we'll need to fetch their balance and respond
                    VPoWPayout.find({
                        address: ws.address
                    }).exec().then(docs => {
                        ws.send(JSON.stringify({
                            action: "pending_balance_response",
                            balance: [
                                new BigNumber(payout[0]).times(docs.length).toFixed(),
                                payout[1]
                            ],
                            hashes: docs.map(e => e.hash.toString("hex"))
                        }))
                    }).catch(console.error)
                }
            }
        }catch{}
    })
})