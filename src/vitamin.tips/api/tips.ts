import { Router } from "express";
import TipStats from "../../models/TipStats";

export default Router()
.get("/recent", async (_, res) => {
    const tips = await TipStats.find().sort({_id: -1}).limit(50)
    res.status(200).send(tips.map(e => {
        return {
            tokenId: e.tokenId,
            amount: e.amount,
            user_id: e.user_id,
            hash: e.txhash.toString("hex")
        }
    }))
})