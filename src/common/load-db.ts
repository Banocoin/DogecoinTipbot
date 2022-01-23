import mongoose from "mongoose"

export let isDBReady = false
export const dbPromise = mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    auth: {
        password: process.env.MONGO_PASSWORD,
        user: process.env.MONGO_USER
    },
    authSource: "admin"
}).then(() => {
    isDBReady = true
})