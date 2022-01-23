import mongoose, { Document, Schema } from "mongoose";

export interface IActiveStats extends Document {
    user_id: number,
    message_id: number,
    createdAt: Date,
    num: number,
    chat_id: number
}

const ActiveSchema = new Schema<IActiveStats>({
    user_id: {
        type: Number,
        required: true
    },
    message_id: {
        type: Number,
        required: true,
        unique: true
    },
    chat_id: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date, 
        expires: 24*60*60
    },
    num: {
        type: Number
    }
})

export default mongoose.model<IActiveStats>("ActiveTelegram", ActiveSchema);