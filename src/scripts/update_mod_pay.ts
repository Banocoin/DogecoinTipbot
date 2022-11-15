import "../common/load-env"
import { dbPromise } from "../common/load-db"
import { VITC_ADMINS, VITC_MODS } from "../discord/constants"
import PersonalAddress from "../models/PersonalAddress"

dbPromise.then(async () => {
    const mods = VITC_MODS
    const targetPay = "15k"
    const addresses = await PersonalAddress.find({
        platform: "Discord"
    })

    for(const mod of mods){
        const address = addresses.find(e => e.id === mod)
        if(!address){
            console.warn(`Cannot find personnal address for ${mod}`)
            continue
        }
        console.info(`${mod}:${address.amount}`)
        address.amount = targetPay
        await address.save()
        console.log(`Updated pay of ${mod} to ${address.amount}`)
    }

    for(const address of addresses){
        if(!VITC_ADMINS.includes(address.id) && !VITC_MODS.includes(address.id)){
            process.stdout.write(`${address.id},`)
        }
    }
})