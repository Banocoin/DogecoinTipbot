import mongoose, { Document, Schema } from "mongoose";

export interface ITipWebhook extends Document {
    bot_id: string,
    webhook_url: string,
    version: number
}

const TipWebhookSchema = new Schema<ITipWebhook>({
    bot_id: {
        type: String,
        unique: true,
        required: true
    },
    webhook_url: {
        type: String,
        required: true
    },
    version: {
        type: Number,
        required: true
    }
})

export default mongoose.model<ITipWebhook>("TipWebhook", TipWebhookSchema);