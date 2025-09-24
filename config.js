
// © 2025 KyuuRzy. All Rights Reserved.
// respect the work, don’t just copy-paste.

const fs = require('fs')

const config = {
    owner: "-",
    botNumber: "-",
    setPair: "12345678",
    thumbUrl: "https://github.com/kiuur.png",
    session: "sessions",
    status: {
        public: true,
        terminal: true,
        reactsw: false
    },
    message: {
        owner: "no, this is for owners only",
        group: "this is for groups only",
        admin: "this command is for admin only",
        private: "this is specifically for private chat"
    },
    settings: {
        title: "kiruku simple wabot !",
        packname: 'kiruku-wabot !',
        description: "this script was created by KyuuRzy",
        author: 'https://www.github.com/kiuur',
        footer: "𝗍𝖾𝗅𝖾𝗀𝗋𝖺𝗆: @𝗌𝗍𝗏𝗇𝗇𝗏𝗌"
    },
    newsletter: {
        name: "kiruku-wabot",
        id: "120363297591152843@newsletter"
    },
    socialMedia: {
        YouTube: "https://youtube.com/@kyuurzy",
        GitHub: "https://github.com/kiuur",
        Telegram: "https://t.me/stvnnvs",
        ChannelWA: "https://whatsapp.com/channel/0029Vaeqym9IHphHwvXk9k1s"
    },
    api: {
        baseurl: "https://zephrine.live/",
        apikey: "kyuurzy" // berlaku sampai tanggal 1 oktober
    },
    sticker: {
        packname: "kiruku-wabot !",
        author: "kyuurzy"
    }
}

module.exports = config;

let file = require.resolve(__filename)
require('fs').watchFile(file, () => {
  require('fs').unwatchFile(file)
  console.log('\x1b[0;32m'+__filename+' \x1b[1;32mupdated!\x1b[0m')
  delete require.cache[file]
  require(file)
})
