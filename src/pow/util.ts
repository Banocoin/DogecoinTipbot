// This file is ported from https://github.com/vitelabs/go-vite/blob/b5e4e26a547947d680ae2264ec08fefab8e2576b/pow/pow.go#L159

import BigNumber from "bignumber.js";
import * as vite from "@vite/vitejs"

const two256 = new BigNumber("2").pow("256")
const one = new BigNumber("1")

export function difficultyToTarget(difficulty: BigNumber):string {
    return two256.div(
        one
        .plus(
            one
            .div(difficulty.precision(64))
        )
    ).toString(16).slice(0, 16)+"0".repeat(64-16)
}
export function targetToDifficulty(target: BigNumber):string {
    return one.div(
        two256
        .div(target.precision(64))
        .minus(one)
    ).toFixed(0)
}

export function hashPoW(nonce: Buffer, data: Buffer):Buffer {
    return Buffer.from(vite.utils.blake2b(Buffer.concat([
        nonce, 
        data
    ]), null, 32))
}

export function padLeftToBuffer(target: string, length: number):Buffer {
    if(target.length > length*2)throw new Error("Original buffer bigger than length")
    if(target.length === length*2)return Buffer.from(target, "hex")

    while(target.length < length*2){
        target = "0" + target
    }

    return Buffer.from(target, "hex")
}

export function quickGreater(x: Buffer, y: Buffer):boolean {
    if(x.length !== y.length)throw new Error("Buffers not the same size")
    for(let i = 0; i < x.length; i++){
        if(x[i] > y[i])return true
        if(x[i] < y[i])return false
        if(x[i] === y[i])continue
    }
    return true
}

export function checkPoWNonce(target: string, nonce: Buffer, data: Buffer): boolean {
    const hash = hashPoW(nonce, data)
    const targetBuffer = padLeftToBuffer(target, 32)

    return quickGreater(hash, targetBuffer)
}