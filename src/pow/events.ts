import WebSocket from "ws";
import { VitaBotEventEmitter } from "../common/events";
import { ExtendedWebsocket } from "./ws";

export default new VitaBotEventEmitter<{
    response: [{
        hash: string,
        nonce: string
    }, WebSocket&ExtendedWebsocket]
}>()