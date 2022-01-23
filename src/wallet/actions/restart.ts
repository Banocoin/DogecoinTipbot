// restart the wallet system

export default async function restart(){
    setTimeout(() => {
        process.exit(0)
    }, 1000)
    return null
}