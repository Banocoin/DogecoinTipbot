import mongoose, { Document, Schema } from "mongoose";

export interface IExternalAddressBlacklist extends Document {
    address: string
}

const ExternalAddressBlacklistSchema = new Schema<IExternalAddressBlacklist>({
    address: {
        type: String,
        required: true,
        unique: true
    }
})

export default mongoose.model<IExternalAddressBlacklist>("ExternalAddressBlacklist", ExternalAddressBlacklistSchema);