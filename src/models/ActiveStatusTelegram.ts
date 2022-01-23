import mongoose, { Document, Schema } from "mongoose";

export interface IActiveStatus extends Document {
    user_id: number,
    createdAt: Date,
    chat_id: number
}

const ActiveStatusSchema = new Schema<IActiveStatus>({
    user_id: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        expires: 60*60
    },
    chat_id: {
        type: Number,
        required: true
    }
})

export default mongoose.model<IActiveStatus>("ActiveStatusTelegram", ActiveStatusSchema);