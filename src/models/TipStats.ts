import mongoose, { Document, Schema } from "mongoose";

export interface ITipStats extends Document {
    tokenId: string,
    amount: number,
    user_id: string,
    txhash: Buffer
}

const TipStatSchema = new Schema<ITipStats>({
    tokenId: {
        required: true,
        type: String
    },
    amount: {
        required: true,
        type: Number
    },
    user_id: {
        required: true,
        type: String
    },
    txhash: {
        type: Buffer,
        required: true,
        unique: true
    }
})

export default mongoose.model<ITipStats>("TipStat", TipStatSchema);