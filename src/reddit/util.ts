import { WebhookClient } from "discord.js"

export const USERNAME_REGEX = /^\/?u\/[A-Za-z0-9_-]+$/

export const blWebhook = new WebhookClient({
    url: process.env.WEBHOOK_INSPECTOR
})