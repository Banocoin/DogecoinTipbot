import mongoose, { Document, Schema } from "mongoose";

export interface IActiveStats extends Document {
    user_id: string,
    message_id: string,
    createdAt: Date,
    num: number
}

const ActiveSchema = new Schema<IActiveStats>({
    user_id: {
        type: String,
        required: true
    },
    message_id: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date, 
        expires: 24*60*60
    },
    num: {
        type: Number
    }
})

export default mongoose.model<IActiveStats>("Active", ActiveSchema);