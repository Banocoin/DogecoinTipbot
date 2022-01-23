// Bypass Discord's anti-spam by saving DM channels ids
import mongoose, { Document, Schema } from "mongoose";

export interface IDiscordDMChannel extends Document {
    user_id: string,
    channel_id: string,
    bot_id: string
}

const DiscordDMChannelSchema = new Schema<IDiscordDMChannel>({
    user_id: {
        type: String,
        required: true
    },
    channel_id: {
        type: String,
        required: true,
        unique: true
    },
    bot_id: {
        type: String,
        required: true
    }
})

export default mongoose.model<IDiscordDMChannel>("DiscordDMChannel", DiscordDMChannelSchema);