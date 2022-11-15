import mongoose, { Document, Schema } from "mongoose";
import { IAddress } from "./Address";

export interface IWalletLinkingSecret extends Document {
    address: IAddress,
    secret: string
}

const WalletLinkingSecretSchema = new Schema<IWalletLinkingSecret>({
    address: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Address",
        required: true,
        unique: true
    },
    secret: {
        type: String,
        unique: true,
        required: true
    }
})

export default mongoose.model<IWalletLinkingSecret>("WalletLinkingSecret", WalletLinkingSecretSchema);