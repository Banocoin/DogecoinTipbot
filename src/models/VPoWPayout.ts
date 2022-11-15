import mongoose, { Document, Schema } from "mongoose";

export interface IVPoWPayout extends Document {
    address: string,
    hash: Buffer,
    date: Date
}

const VPoWPayoutSchema = new Schema<IVPoWPayout>({
    address: {
        type: String,
        required: true
    },
    hash: {
        type: Buffer,
        required: true,
        unique: true
    },
    date: {
        type: Date,
        required: true
    }
})

export default mongoose.model<IVPoWPayout>("VPoWPayout", VPoWPayoutSchema);