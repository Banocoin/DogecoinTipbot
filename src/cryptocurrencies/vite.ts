import { tokenDecimals, tokenIds, tokenNames, tokenTickers } from "../common/constants";
import { WebsocketConnection } from "../libwallet/ws";
import { GetTokenResponse, requestWallet } from "../libwallet/http";
import events from "../common/events";
import { wait } from "../common/util";

export const walletConnection = new WebsocketConnection()

export let isWalletReady = false
export const walletReadyPromise = new Promise<void>(resolve => {
    events.once("wallet_ready", () => {
        resolve()
        isWalletReady = true
    })
})

;(async () => {
    await walletConnection.connect()
    let once = true
    // eslint-disable-next-line no-constant-condition
    while(true){
        const tokens:GetTokenResponse = await requestWallet("get_tokens")
    
        for(const ticker in tokens.token_decimals){
            if(ticker in tokenDecimals)continue
            tokenDecimals[ticker] = tokens.token_decimals[ticker]
        }
        for(const ticker in tokens.token_ids){
            if(ticker in tokenIds)continue
            tokenIds[ticker] = tokens.token_ids[ticker]
        }
        for(const ticker in tokens.token_names){
            if(ticker in tokenNames)continue
            tokenNames[ticker] = tokens.token_names[ticker]
        }
        for(const tokenId in tokens.token_tickers){
            if(tokenId in tokenTickers)continue
            tokenTickers[tokenId] = tokens.token_tickers[tokenId]
        }
        if(once)events.emit("wallet_ready")
        once = false
        await wait(30*60*1000)
    }
})()