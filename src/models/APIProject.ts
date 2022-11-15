import mongoose, { Document, Schema } from "mongoose";

export interface IAPIProject extends Document {
    key: string,
    name: string,
    addresses: string[],
    project_id: string
}

const APIProjectSchema = new Schema<IAPIProject>({
    key: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        unique: true
    },
    addresses: [{
        type: String,
        required: true,
        unique: true
    }],
    project_id: {
        type: String,
        required: true,
        unique: true
    }
})

export default mongoose.model<IAPIProject>("APIProject", APIProjectSchema);