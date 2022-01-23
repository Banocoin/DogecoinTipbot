import mongoose, { Document, Schema } from "mongoose";

export interface IActiviaFreeze extends Document {
    user_id: number
}

const ActiveStatusSchema = new Schema<IActiviaFreeze>({
    user_id: {
        type: Number,
        required: true
    }
})

export default mongoose.model<IActiviaFreeze>("ActiveFreezeTelegram", ActiveStatusSchema);