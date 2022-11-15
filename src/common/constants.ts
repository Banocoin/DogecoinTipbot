import { MessageEmbed } from "discord.js"
import { BOT_OWNER } from "../discord/constants"

export const VITC_COLOR = "#e7581c"
export const VITABOT_GITHUB = "https://github.com/jeanouina/VitaBot"
export const BOT_VERSION = require("../../package.json").version

export type Networks = "VITE"
export type RawPlatform = "Discord" | "Twitter" | "Telegram" | "Reddit"
export type Platform = RawPlatform |
    "Discord.Giveaway" | "Discord.Airdrop" | "Discord.Link" |
    "Twitter.Giveaway" |"Twitter.Airdrop" |
    "Telegram.Airdrop" | "Telegram.Giveaway" |
    "Reddit.Airdrop" | "Reddit.Giveaway" |
    "Faucet" | "Quota" | "Rewards" | "Rewards.Vitoge" |
    "Bank"

export const tokenIds = {
    VITE: "tti_5649544520544f4b454e6e40",
    VITC: "tti_22d0b205bed4d268a05dfc3c",
    BAN: "tti_f9bd6782f966f899d74d7df8",
    NANO: "tti_29a2af20212b985e9d49e899",
    BTC: "tti_b90c9baffffc9dae58d1f33f",
    VX: "tti_564954455820434f494e69b5",
    VCP: "tti_251a3e67a41b5ea2373936c8",
    XMR: "tti_e5750d3c5b3bb5a31b8ba637",
    ETH: "tti_687d8a93915393b219212c73",
    USDT: "tti_80f3751485e4e83456059473",
    VINU: "tti_541b25bd5e5db35166864096",
    MESH: "tti_8b971a1b4735fcd83c999272",
    VITOGE: "tti_22a70f6a6c078f7f976c163e",
    VICAT: "tti_b3fbb46b9318b3d168ba904e",
    VIVA: "tti_a23c2f75791efafe5fada99e",
    UST: "tti_3d482aaceb076a729cb3967b",
    LUNC: "tti_60ce61fb1bf38a32be3bfb91",
    NYA: "tti_14559f510fa839880af467d1",
    FTM: "tti_42dda11891d8073f08578289",
    WAXP: "tti_5c3e2df1729d8d402a8275b8",
    SAITO: "tti_8364a003d3a2d3c22af015ec",
    AVAX: "tti_c34069d833433fa25ae97441",
    XLM: "tti_181e08c4fdb2876956245076",
    KNOBSACK: "tti_93939ea53d7726c1c0ee0196",
    MINION: "tti_da32dc3230fd8d25b4f215f9",
    MANGO: "tti_fb14e5b39124a833fec95fa9",
    DOGE: "tti_6f1756ae2c4eecbd13dfea82",
    DOGECOIN: "tti_6f1756ae2c4eecbd13dfea82",
    LUNA: "tti_f5c5446b8621bea7410fd454",
    HBIT: "tti_c192655916fa8582e71d9999"
}
export const tokenTickers = {
    [tokenIds.VITE]: "VITE",
    [tokenIds.VITC]: "VITC",
    [tokenIds.BAN]: "BAN",
    [tokenIds.NANO]: "NANO",
    [tokenIds.BTC]: "BTC",
    [tokenIds.VX]: "VX",
    [tokenIds.VCP]: "VCP",
    [tokenIds.XMR]: "XMR",
    [tokenIds.ETH]: "ETH",
    [tokenIds.USDT]: "USDT",
    [tokenIds.VINU]: "VINU",
    [tokenIds.MESH]: "MESH",
    [tokenIds.VITOGE]: "VITOGE",
    [tokenIds.VICAT]: "VICAT",
    [tokenIds.VIVA]: "VIVA",
    [tokenIds.UST]: "UST",
    [tokenIds.LUNC]: "LUNC",
    [tokenIds.NYA]: "NYA",
    [tokenIds.WAXP]: "WAXP",
    [tokenIds.FTM]: "FTM",
    [tokenIds.SAITO]: "SAITO",
    [tokenIds.AVAX]: "AVAX",
    [tokenIds.XLM]: "XLM",
    [tokenIds.KNOBSACK]: "KNOBSACK",
    [tokenIds.MINION]: "MINION",
    [tokenIds.MANGO]: "MANGO",
    [tokenIds.DOGE]: "DOGE",
    [tokenIds.LUNA]: "LUNA",
    [tokenIds.HBIT]: "HBIT"
}
export const tokenDecimals = {
    VITE: 18,
    VITC: 18,
    BAN: 29,
    NANO: 30,
    BTC: 8,
    VX: 18,
    VCP: 0,
    XMR: 12,
    ETH: 18,
    USDT: 6,
    VINU: 18,
    MESH: 18,
    VITOGE: 18,
    VICAT: 7,
    VIVA: 18,
    UST: 6,
    LUNC: 6,
    NYA: 18,
    FTM: 18,
    SAITO: 18,
    AVAX: 18,
    WAXP: 8,
    XLM: 7,
    KNOBSACK: 0,
    MINION: 18,
    MANGO: 7,
    DOGE: 8,
    DOGECOIN: 8,
    LUNA: 6,
    HBIT: 8
}
export const tokenNames = {
    VITE: "Vite",
    VITC: "Vitamin Coin",
    BAN: "Banano",
    NANO: "Nano",
    BUS: "Bussycoin",
    XRB: "RayBlocks",
    BANG: "Banano Gold",
    BROCC: "Broccoli 🥦",
    "VINU-000": "Vita Inu [old]",
    MESH: "Mesh",
    VITOGE: "Vitoge",
    VICAT: "ViCat",
    VIVA: "Viva",
    UST: "UST",
    LUNC: "Luna Classic",
    "NYA-000": "Nyanold",
    FTM: "Fantom",
    SAITO: "Saito",
    AVAX: "Avalanche",
    WAXP: "Wax",
    XLM: "Stellar",
    KNOBSACK: "Bag Of Dicks",
    MINION: "Minion token",
    MANGO: "Manangos",
    DOGE: "Dogecoin",
    DOGECOIN: "Dogecoin",
    LUNA: "Luna",
    HBIT: "Hashbit"
}

export const discordEmojis = {
    VITE: "<:Vite:919479150304198726>",
    VITC: "<:Vitc:909415321964789821>",
    BAN: "<:Banano:902883289478594611>",
    NANO: "<:Nano:902883450820898817>",
    BUS: "<:BussyCoin:902882531303649321>",
    XRB: "<:RayBlocks:911705047509925978>",
    BANG: "<:BananoGold:902882181087649842>",
    VICAT: "<:vicat:965350345888890900>",
    VINU: "<:vitainuhead:913716884476674078>",
    CAPS: "<:bottlecaps:916633374536368138>",
    MESH: "🕸️",
    VIVA: "<:viva:919131398172975106>",
    PAW: "<:paw:928649144388681728>",
    NYA: "<:nyani:941269952659337278>",
    KNOBSACK: "<:knobsack:962707955596288030>",
    MINION: "<:minion:1004018599742165124>",
    MANGO: "<:manangos:1037083591651360888>",
    PEPPER: "<:peppercoin:1037085192076144640>",
    KIVI: "<:kivi:1037088863383994378>"
}

export const defaultEmoji = "💊"

export const serverEmojis = {
    // vinu
    "904853001850728458": "913716884476674078",
    // viva
    "905855357795061832": "919131398172975106",
    // vicat
    "904753026252816414": "965350345888890900",
    // vitc
    "907279842716835881": "909415321964789821",
    // brocc
    "904117111763402752": "🥦",
    // mesh
    "916755202495901837": "🕸️",
    // Knobsack
    "893911938038374430": "962707955596288030",
    // MINION
    "955431655810674759": "1004018599742165124"
}

export const disabledServers = {
    "837490044959981578": "Bananoman's server",
    "818704918654222377": "Bananoman's server",
    "844839956992229436": "Bananoman's server",
    "858836421644648479": "Bananoman's server",
    "855589172085784616": "Bananoman's server",
    "854318944936525834": "Bananoman's server",
    "847703733035204608": "Bananoman's server",
    "854321960246312980": "Bananoman's server"
}

export const disabledTokens = {
    tti_3340701118e8a54d34b52355: "Old VINU Token",
    // Bananoman's BUS
    tti_7c6f76ec3db1c8de0bcbda97: "This token has been blacklisted because the owner is engaged in potentially suspicious activities",
    // Bananoman's xrb
    tti_4edfa56164529e67c719a1e0: "This token has been blacklisted because the owner is engaged in potentially suspicious activities",
    // Bananoman's bang
    tti_3ff31d74799626b336ec9ff0: "This token has been blacklisted because the owner is engaged in potentially suspicious activities",
    // Bananoman's sqd
    tti_586f09964cc57fdfea61e4ba: "This token has been blacklisted because the owner is engaged in potentially suspicious activities",
    // Bananoman's benis
    tti_4e9c1e66718021edf8e7604e: "This token has been blacklisted because the owner is engaged in potentially suspicious activities",
    // Bananoman's FUCK
    tti_b10c254ddb5dc0e939aa22b0: "This token has been blacklisted because the owner is engaged in potentially suspicious activities",
    // Bananoman's DOGE
    tti_967c4f6f3bab275907cc8c05: "This token has been blacklisted because the owner is engaged in potentially suspicious activities",
    // Vitoge
    tti_22a70f6a6c078f7f976c163e: "Due to recent events within Vitoge, we will no longer support the use of the token in Vitabot, and will be ceasing support of SBP distribution, effective immediately."
}

export const twitterEmojis = {
    VITC: "💊",
    BAN: "🍌",
    VINU: "🐕",
    VICAT: "🐱",
    MESH: "🕸️",
    UST: "🇺🇸",
    LUNA: "🌕"
}

export const AIRDROP_MIN = "$0.10"
export const AIRDROP_MIN_WHITELISTED = {
    // brocc
    tti_846b406693379db860b47694: "100k",
    // caps
    tti_4cd2341e510a759dd503cd65: "5",
    // Nyani
    tti_14559f510fa839880af467d1: "100",
    // vikey
    tti_d052213952838e8379bf32b9: "100",
    // knobsack
    [tokenIds.KNOBSACK]: "69",
    // Neo Inu
    tti_9a535b848705000fa5654a72: "1000000",
    // MINION
    tti_da32dc3230fd8d25b4f215f9: "100",
    // sharkbenis
    tti_319be644dc8d2d6ad154e309: "119",
    // wookcoin
    tti_c51a895eb8c3dca03d362e4f: "100k",
    // PEPPER
    tti_cd0d3f2fdf25b72485caf435: "500"

}
export const RAIN_MIN = "$0.10"
export const RAIN_MIN_WHITELISTED = {
    // brocc
    tti_846b406693379db860b47694: "100k",
    // caps
    tti_4cd2341e510a759dd503cd65: "5",
    // Nyani
    tti_14559f510fa839880af467d1: "100",
    // vikey
    tti_d052213952838e8379bf32b9: "100",
    // knobsack
    [tokenIds.KNOBSACK]: "69",
    // Neo Inu
    tti_9a535b848705000fa5654a72: "1000000",
    // MINION
    tti_da32dc3230fd8d25b4f215f9: "100",
    // sharkbenis
    tti_319be644dc8d2d6ad154e309: "119",
    // wookcoin
    tti_c51a895eb8c3dca03d362e4f: "100k",
    // PEPPER
    tti_cd0d3f2fdf25b72485caf435: "500"
}

export const allowedCoins = {
    // VITC OLD
    "862416292760649768": [
        tokenIds.VITC,
        tokenIds.VITE,
        tokenIds.NANO,
        tokenIds.BAN,
        tokenIds.VX
    ],
    // VITC
    "907279842716835881": [
        tokenIds.VITC,
        tokenIds.VITE,
        tokenIds.NANO,
        tokenIds.BAN,
        tokenIds.VX,
        tokenIds.LUNA,
        tokenIds.UST,
        tokenIds.SAITO,
        tokenIds.WAXP,
        tokenIds.FTM,
        tokenIds.AVAX,
        // e
        "tti_b8bcf8c943627b2c5cbe1805"
    ],
    // VINU
    "904853001850728458": [
        tokenIds.VINU,
        tokenIds.VITE,
        tokenIds.NANO,
        tokenIds.BAN,
        tokenIds.VITC,
        tokenIds.VX,
        // Paw
        "tti_ae7c9df2d83d9815424c5ecc"
    ],
    //Mesh
    "916755202495901837": [
        tokenIds.VITE,
        tokenIds.MESH
    ],
    // Hashbit
    "1003690095875981392": [
        tokenIds.VITE,
        tokenIds.VITC,
        tokenIds.HBIT // HBIT
    ]
}

export const tos = {
    embed: new MessageEmbed()
        .setColor(VITC_COLOR)
        .setDescription(`**VitaBot is beta software**
> In no event shall VitaBot or its authors be responsible for any lost, misdirected or stolen funds

**Tips are non-reversible and non-refundable.**
> Tips are transactions on the blockchain, they cannot be reversed and will not be refunded. Please check twice before making any tips.

**VitaBot's security**
> Your balance's security is as safe as your Discord account is. Use features like two-factor authentication to keep your account secure. In regards to VitaBot's security – we hold up to industry standards. Your wallet is powered by our tested and proven technology. In case of concerns, please dm <@${BOT_OWNER}> \`Not Thomiz#0001\`.

**Privacy disclaimer**
> We reserve the right to create an invite and join any server the bot is in, if suspicious activity on it is detected.

**Abuse**
> If you are found abusing any systems in the Vitamin Coin server or any other server, your funds will be frozen and seized. We reserve the right to freeze suspicious accounts as well, until proven innocent.

**Always keep small sums of money only**
> Even if we keep up with industry standards in terms of security practices, we ask you to not keep huge sums on the bot. Please keep them in a non-custodial wallet.

By using the bot, you agree to the terms and conditions above.`)
        .setTitle("📝 Terms and conditions"),
    readme: `# 📝 Terms and conditions
    
**VitaBot is beta software**
In no event shall VitaBot or its authors be responsible for any lost, misdirected or stolen funds

**Tips are non-reversible and non-refundable.**
Tips are transactions on the blockchain, they cannot be reversed and will not be refunded. Please check twice before making any tips.

**VitaBot's security**
Your balance's security is as safe as your Discord account is. Use features like two-factor authentication to keep your account secure. In regards to VitaBot's security – we hold up to industry standards. Your wallet is powered by our tested and proven technology. In case of concerns, please dm <@${BOT_OWNER}> \`Not Thomiz#0001\`.

**Privacy disclaimer**
We reserve the right to create an invite and join any server the bot is in, if suspicious activity on it is detected.

**Abuse**
If you are found abusing any systems in the Vitamin Coin server or any other server, your funds will be frozen and seized. We reserve the right to freeze suspicious accounts as well, until proven innocent.

**Always keep small sums of money only**
Even if we keep up with industry standards in terms of security practices, we ask you to not keep huge sums on the bot. Please keep them in a non-custodial wallet.

By using the bot, you agree to the terms and conditions above.`,
    text: `📝 Terms and conditions

VitaBot is beta software
In no event shall VitaBot or its authors be responsible for any lost, misdirected or stolen funds

Tips are non-reversible and non-refundable.
Tips are transactions on the blockchain, they cannot be reversed and will not be refunded. Please check twice before making any tips.

VitaBot's security
Your balance's security is as safe as your Discord account is. Use features like two-factor authentication to keep your account secure. In regards to VitaBot's security – we hold up to industry standards. Your wallet is powered by our tested and proven technology. In case of concerns, please dm <@${BOT_OWNER}> \`Not Thomiz#0001\`.

Privacy disclaimer
We reserve the right to create an invite and join any server the bot is in, if suspicious activity on it is detected.

Abuse
If you are found abusing any systems in the Vitamin Coin server or any other server, your funds will be frozen and seized. We reserve the right to freeze suspicious accounts as well, until proven innocent.

Always keep small sums of money only
Even if we keep up with industry standards in terms of security practices, we ask you to not keep huge sums on the bot. Please keep them in a non-custodial wallet.

By using the bot, you agree to the terms and conditions above.`
}
