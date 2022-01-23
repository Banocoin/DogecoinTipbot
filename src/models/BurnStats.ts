import mongoose, { Document, Schema } from "mongoose";

export interface IBurnStat extends Document {
    tokenId: string,
    amount: number,
    user_id: string,
    txhash: Buffer
}

const BurnStatSchema = new Schema<IBurnStat>({
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

export default mongoose.model<IBurnStat>("BurnStat", BurnStatSchema);