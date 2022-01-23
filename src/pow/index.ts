// Help support VitaBot by doing pows
import "../common/load-env"
import { dbPromise } from "../common/load-db"
import express from "express"
import { Server } from "http"
import { wss } from "./ws"

dbPromise.then(async () => {
    // connected to db
    const app = express()
    .disable("x-powered-by")
    .post(
        "/", 
        (req, res, next) => {
            // only allow localhost to access this service.
            if(!["::ffff:127.0.0.1", "127.0.0.1"].includes(req.ip))return res.status(401).send({
                error: {
                    name: "UnauthorizedError",
                    message: "Your ip isn't allowed to access this service."
                }
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
                    error: {
                        name: err.name,
                        message: err.message
                    }
                })
            }
        },
        (req, res) => {
/* 

{
  action: 'work_generate',
  hash: 'ef808e0b7326720a9c655350181dffacfd9be82d258703783cc891d11a4e693f',
  threshold: 'ffffffc000000000000000000000000000000000000000000000000000000000'
}

*/
            switch(req.body.action){
                case "work_generate": {
                    // ask nodes
                }
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
})