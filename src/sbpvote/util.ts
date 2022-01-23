import { getVITEAddressOrCreateOne } from "../wallet/address";

export async function getBlockedAddresses(){
    return (await Promise.all([
        // vitc mods weekly distribution
        getVITEAddressOrCreateOne("Mods", "Rewards"),
        // claiming sbp address
        getVITEAddressOrCreateOne("SBPClaim", "Rewards"),
        // dao sbp rewards
        getVITEAddressOrCreateOne("DAO", "Rewards"),
        // sbp voters rewards
        getVITEAddressOrCreateOne("SBP", "Rewards"),
        
        // Vitoge SBP claim address
        getVITEAddressOrCreateOne("SBPClaim", "Rewards.Vitoge"),
        // Vitoge SBP voters rewards
        getVITEAddressOrCreateOne("SBP", "Rewards.Vitoge"),

        // VitaBot Quota Accelerator
        getVITEAddressOrCreateOne("Batch", "Quota")
    ])).map(e => e.address)
}