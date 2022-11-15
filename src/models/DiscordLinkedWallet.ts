import mongoose, { Document, Schema } from "mongoose";

export interface IDiscordLinkedWallet extends Document {
    user: Date,
    address: string
}

const DiscordLinkedWalletSchema = new Schema<IDiscordLinkedWallet>({
    user: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true,
        unique: true
    }
})

export default mongoose.model<IDiscordLinkedWallet>("DiscordLinkedWallet", DiscordLinkedWalletSchema);