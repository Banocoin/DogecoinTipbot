 import mongoose, { Document, Schema } from "mongoose";

export interface ITelegramUsername extends Document {
    user_id: number,
    username: string
}

const TelegramUsernameSchema = new Schema<ITelegramUsername>({
    user_id: {
        type: Number,
        required: true,
        unique: true
    },
    username: {
        type: String
    }
})

export default mongoose.model<ITelegramUsername>("TelegramUsername", TelegramUsernameSchema);