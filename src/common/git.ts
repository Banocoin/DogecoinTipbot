import * as child_process from "child_process"
import ActionQueue from "./queue"

export const gitQueue = new ActionQueue<string>()

export async function cloneRepo(url:string, destination:string){
    return new Promise<void>((resolve, reject) => {
        const process = child_process.spawn("git", ["clone", url, destination])
        process.on("exit", code => {
            if(code !== 0){
                // error occured
                reject(new Error("Couldn't clone git repository"))
            }else{
                resolve()
            }
        })
    })
}

export async function pullRepo(cwd:string){
    return new Promise<void>((resolve, reject) => {
        const process = child_process.spawn("git", ["pull"], {
            cwd: cwd
        })
        process.on("exit", code => {
            if(code !== 0){
                // error occured
                reject(new Error("Couldn't pull git repository"))
            }else{
                resolve()
            }
        })
    })
}