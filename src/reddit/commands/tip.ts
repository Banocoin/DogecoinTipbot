import { Comment, PrivateMessage } from "snoowrap";
import { getVITEAddressOrCreateOne } from "../../wallet/address";
import Command from "../command";
import { disabledTokens, tokenIds } from "../../common/constants";
import BigNumber from "bignumber.js";
import { parseAmount } from "../../common/amounts";
import { convert, tokenNameToDisplayName } from "../../common/convert";
import { USERNAME_REGEX } from "../util";
import { client } from "..";
import redditqueue from "../redditqueue";
import viteQueue from "../../cryptocurrencies/viteQueue";
import { requestWallet } from "../../libwallet/http";
import { tokenPrices } from "../../common/price";
import RedditUsername from "../../models/RedditUsername";

export default new class TipCommand implements Command {
    alias = ["tip"]
    usage = "";
    description = "Send a tip to someone";
    async executePublic(item: Comment, args: string[]): Promise<any> {
        let [
            // eslint-disable-next-line prefer-const
            amount,
            currency,
            // eslint-disable-next-line prefer-const
            ...recipientsRaw
        ] = args
        currency = currency || "vitc"
        if(!amount)return item.reply("Invalid Amount").then(()=>{})
        if(USERNAME_REGEX.test(currency)){
            recipientsRaw.unshift(currency)
            currency = "vitc"
        }

        currency = currency.toUpperCase()

        if(!(currency in tokenIds)){
            await item.reply(`The token **${currency}** isn't supported.`)
                .then(()=>{})
        }
        if((tokenIds[currency] in disabledTokens)){
            await item.reply(`The token **${currency}** is currently disabled, because: ${disabledTokens[tokenIds[currency]]}`)
                .then(()=>{})
            return
        }
        let amountParsed:BigNumber
        try{
            amountParsed = parseAmount(amount, tokenIds[currency])
        }catch{
            return item.reply("Invalid Amount").then(()=>{})
        }
        if(amountParsed.isEqualTo(0)){
            await item.reply(`You can't send a tip of **0 ${tokenNameToDisplayName(currency)}**.`)
                .then(()=>{})
            return
        }

        const recipients = []
        const promises = []
        let shouldFetchPostAbove = true
        for(const recipient of recipientsRaw){
            if(!USERNAME_REGEX.test(recipient))break
            shouldFetchPostAbove = false
            promises.push((async () => {
                const username = recipient.split("/").pop()
                try{
                    // oh my fucking god snoowrap is shit
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    const user = await client.getUser(username).fetch()
                    // try to search if their id is in our database or nope
                    try{
                        const u = await RedditUsername.findOne({
                            user_id: user.id
                        })
                        if(!u){
                            await RedditUsername.create({
                                user_id: user.id,
                                username: user.name
                            })
                        }else if(u.username !== user.name){
                            u.username = user.name
                            await u.save()
                        }
                    }catch{}
                    recipients.push(user.id)
                }catch(err){
                    console.error(err)
                }
            })())
        }
        if(shouldFetchPostAbove){
            promises.push((async () => {
                try{
                    const parent_id = await item.parent_id
                    const prefix = parent_id.slice(0, 2)
                    const id = parent_id.slice(3)
                    switch(prefix){
                        case "t1": {
                            const authorId = await client.getComment(id).author.id
                            const authorName = await client.getComment(id).author.name
                            recipients.push(authorId)
                            // try to search if their id is in our database or nope
                            try{
                                const u = await RedditUsername.findOne({
                                    user_id: authorId
                                })
                                if(!u){
                                    await RedditUsername.create({
                                        user_id: authorId,
                                        username: authorName
                                    })
                                }else if(u.username !== authorName){
                                    u.username = authorName
                                    await u.save()
                                }
                            }catch{}
                            break
                        }
                        case "t3": {
                            const authorId = await client.getSubmission(id).author.id
                            const authorName = await client.getSubmission(id).author.name
                            recipients.push(authorId)
                            // try to search if their id is in our database or nope
                            try{
                                const u = await RedditUsername.findOne({
                                    user_id: authorId
                                })
                                if(!u){
                                    await RedditUsername.create({
                                        user_id: authorId,
                                        username: authorName
                                    })
                                }else if(u.username !== authorName){
                                    u.username = authorName
                                    await u.save()
                                }
                            }catch{}
                        }
                    }
                }catch(err){
                    console.error(err)
                }
            })())
        }

        await Promise.all(promises)
        if(!recipients.length){
            return item.reply("Couldn't find any recipient in your message.").then(()=>{})
        }
        const totalAsked = amountParsed.times(recipients.length)
        
        const authorId = await item.author.id
        const [
            address,
            addresses
        ] = await Promise.all([
            redditqueue.queueAction(authorId, async () => {
                return getVITEAddressOrCreateOne(authorId, "Reddit")
            }),
            Promise.all(recipients.map(recipient => {
                return getVITEAddressOrCreateOne(recipient, "Reddit")
            }))
        ])

        if(address.paused){
            return item.reply("Your account has been frozen, likely for using alts or abusing a faucet/rains. Please contact u/aThomized to unlock your account.").then(()=>{})
        }

        await viteQueue.queueAction(address.address, async () => {
            const balances = await requestWallet("get_balances", address.address)
            const token = tokenIds[currency]
            const balance = new BigNumber(balances[token] || "0")
            const totalAskedRaw = new BigNumber(convert(totalAsked, currency, "RAW"))

            if(balance.isLessThan(totalAskedRaw)){
                return item.reply(`You don't have enough money to cover this tip. You need **${
                    totalAsked.toFixed()
                } ${
                    tokenNameToDisplayName(currency)
                }** but you only have **${
                    convert(balance, "RAW", currency)
                } ${
                    tokenNameToDisplayName(currency)
                }** in your balance. Use .deposit to top up your account.`)
                .then(()=>{})
            }

            if(addresses.length > 1){
                const amount = convert(amountParsed, currency, "RAW")
                const txs = await requestWallet(
                    "bulk_send",
                    address.address, 
                    addresses
                    .map(e => [
                        e.address,
                        amount
                    ]),
                    token
                )
                const pair = tokenPrices[token+"/"+tokenIds.USDT]
                await item.reply(`Sent ${
                    convert(amount, "RAW", currency)
                } ${
                    tokenNameToDisplayName(currency)
                } (= **$${
                    new BigNumber(pair?.closePrice || 0)
                    .times(amountParsed)
                    .decimalPlaces(2).toFixed(2)
                }**) to ${recipients.length} recipients (**${
                    new BigNumber(convert(amount, "RAW", currency))
                    .times(recipients.length)
                    .toFixed()
                } ${
                    tokenNameToDisplayName(currency)
                }** = **$${
                    new BigNumber(pair?.closePrice || 0)
                    .times(amountParsed)
                    .times(recipients.length)
                    .decimalPlaces(2).toFixed(2)
                }**)
                
[\`${txs[0][0].hash}\`](https://vitcscan.com/tx/${txs[0][0].hash})`)
                .then(()=>{})
            }else{
                const amount = convert(amountParsed, currency, "RAW")
                const tx = await requestWallet(
                    "send",
                    address.address, 
                    addresses[0].address, 
                    amount, 
                    token
                )
                const pair = tokenPrices[token+"/"+tokenIds.USDT]
                await item.reply(`Sent **${
                    convert(amount, "RAW", currency)
                } ${
                    tokenNameToDisplayName(currency)
                }** (= **$${
                    new BigNumber(pair?.closePrice || 0)
                    .times(amountParsed)
                    .decimalPlaces(2).toFixed(2)
                }**) to **1 recipient**
                
[\`${tx.hash}\`](https://vitcscan.com/tx/${tx.hash})`)
                    .then(()=>{})
            }
        })
    }

    async executePrivate(item: PrivateMessage): Promise<any> {
        return item.reply("Please execute this command in a comment.")
        .then(()=>{})
    }
}