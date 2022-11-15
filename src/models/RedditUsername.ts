import mongoose, { Document, Schema } from "mongoose";

export interface IRedditUsername extends Document {
    user_id: string,
    username: string
}

const RedditUsernameSchema = new Schema<IRedditUsername>({
    user_id: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String
    }
})

export default mongoose.model<IRedditUsername>("RedditUsername", RedditUsernameSchema);