import { MessageEmbed } from "discord.js"
import { BOT_OWNER } from "../discord/constants"

export const VITC_COLOR = "#e7581c"
export const VITABOT_GITHUB = "https://github.com/jeanouina/VitaBot"
export const BOT_VERSION = require("../../package.json").version

export type Networks = "VITE"
export type RawPlatform = "Discord" | "Twitter" | "Telegram"
export type Platform = RawPlatform |
    "Discord.Giveaway" | "Twitter.Giveaway" | "Telegram.Giveaway" | 
    "Discord.Airdrop" | "Twitter.Airdrop" | "Telegram.Airdrop" | 
    "Faucet" | "Quota" | "Rewards" | "Rewards.Vitoge"

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
    LUNA: "tti_60ce61fb1bf38a32be3bfb91"
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
    [tokenIds.LUNA]: "LUNA"
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
    VINU: 8,
    MESH: 18,
    VITOGE: 18,
    VICAT: 7,
    VIVA: 18,
    UST: 6,
    LUNA: 6
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
    LUNA: "Luna"
}

export const discordEmojis = {
    VITE: "<:Vite:919479150304198726>",
    VITC: "<:Vitc:909415321964789821>",
    BAN: "<:Banano:902883289478594611>",
    NANO: "<:Nano:902883450820898817>",
    BUS: "<:BussyCoin:902882531303649321>",
    XRB: "<:RayBlocks:911705047509925978>",
    BANG: "<:BananoGold:902882181087649842>",
    VICAT: "<:ViCat:908227330344910869>",
    VINU: "<:vitainuhead:913716884476674078>",
    CAPS: "<:bottlecaps:916633374536368138>",
    MESH: "🕸️",
    VIVA: "<:viva:919131398172975106>",
    PAW: "<:paw:928649144388681728>"
}

export const defaultEmoji = "💊"

export const serverEmojis = {
    // vinu
    "904853001850728458": "913716884476674078",
    // viva
    "905855357795061832": "919131398172975106",
    // vicat
    "904753026252816414": "908227330344910869",
    // vitc
    "907279842716835881": "909415321964789821",
    // brocc
    "904117111763402752": "🥦",
    // mesh
    "916755202495901837": "🕸️"
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
    tti_b10c254ddb5dc0e939aa22b0: "This token has been blacklisted because the owner is engaged in potentially suspicious activities"
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
    // vicat
    tti_b3fbb46b9318b3d168ba904e: "777",
    // brocc
    tti_846b406693379db860b47694: "100k",
    // caps
    tti_4cd2341e510a759dd503cd65: "5",
    // viva
    tti_a23c2f75791efafe5fada99e: "100",
    // best of medical
    tti_e463f70868334ebd591cff80: "50",
    // farm
    tti_ac7cb5fe2e5b1f5240691657: "100",
    // Nyani
    tti_57ed765fed9121e382efbf54: "10000",
    // vikey
    tti_d052213952838e8379bf32b9: "100"

}
export const RAIN_MIN = "$0.10"
export const RAIN_MIN_WHITELISTED = {
    // vicat
    tti_b3fbb46b9318b3d168ba904e: "777",
    // brocc
    tti_846b406693379db860b47694: "100k",
    // caps
    tti_4cd2341e510a759dd503cd65: "5",
    // viva
    tti_a23c2f75791efafe5fada99e: "100",
    // best of medical
    tti_e463f70868334ebd591cff80: "50",
    // farm
    tti_ac7cb5fe2e5b1f5240691657: "100",
    // Nyani
    tti_57ed765fed9121e382efbf54: "10000",
    // vikey
    tti_d052213952838e8379bf32b9: "100"
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
        tokenIds.VX
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
        // Mesh
        tokenIds.MESH
    ]
}

// https://i.imgur.com/1hYUMmF.png
export const VITABOT_SPLASH = ` ___      ___ ___  _________  ________  ________  ________  _________   
|\\  \\    /  /|\\  \\|\\___   ___\\\\   __  \\|\\   __  \\|\\   __  \\|\\___   ___\\ 
\\ \\  \\  /  / | \\  \\|___ \\  \\_\\ \\  \\|\\  \\ \\  \\|\\ /\\ \\  \\|\\  \\|___ \\  \\_| 
 \\ \\  \\/  / / \\ \\  \\   \\ \\  \\ \\ \\   __  \\ \\   __  \\ \\  \\\\\\  \\   \\ \\  \\  
  \\ \\    / /   \\ \\  \\   \\ \\  \\ \\ \\  \\ \\  \\ \\  \\|\\  \\ \\  \\\\\\  \\   \\ \\  \\ 
   \\ \\__/ /     \\ \\__\\   \\ \\__\\ \\ \\__\\ \\__\\ \\_______\\ \\_______\\   \\ \\__\\
    \\|__|/       \\|__|    \\|__|  \\|__|\\|__|\\|_______|\\|_______|    \\|__|`

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