/**
 !========================!
 * Credit: KyuuRzy
 * Modifed By: RullzFuqi
 !========================!
  * Shanks - WhatsApp Bot
 */

// -----------------------------------------------------------------------------
// Core Imports
// -----------------------------------------------------------------------------
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { exec as execCb } from 'child_process';
import fetch from 'node-fetch';

// Application-specific imports
import config from './config.js';
import RPGSystem from './engine/engine.rpg.js';
import {
  sleep,
  fmt,
  randomId,
  isUrl,
  extractUrls,
  parseCommand,
  getBuffer,
  fetchJson,
  detectFileType,
  FileCache,
  RateLimiter,
  streamToFile,
  BaileysMediaDownloader,
  retry,
} from './engine/engine.utils.js';

// -----------------------------------------------------------------------------
// ANSI Color Utilities
// -----------------------------------------------------------------------------
const ESC = String.fromCharCode(27);
const ANSI = {
  reset: `${ESC}[0m`,
  magenta: `${ESC}[35m`,
  white: `${ESC}[37m`,
  green: `${ESC}[32m`,
  red: `${ESC}[31m`,
  cyan: `${ESC}[36m`,
  yellow: `${ESC}[33m`,
};

const colorLog = (tag, message = '') => {
  console.log(`${ANSI.magenta}[${tag}]${ANSI.reset} ${message}`);
};

const now = () =>
  new Date().toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

// -----------------------------------------------------------------------------
// Static Assets Management
// -----------------------------------------------------------------------------
const ASSETS = {
  image: fs.existsSync('./thumbnail/image.jpg') ? fs.readFileSync('./thumbnail/image.jpg') : null,
  docu: fs.existsSync('./thumbnail/document.jpg')
    ? fs.readFileSync('./thumbnail/document.jpg')
    : null,
};

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------
const exec = (cmd) =>
  new Promise((resolve, reject) => {
    execCb(cmd, (err, stdout, stderr) => {
      err ? reject(err) : resolve(stdout || stderr || '');
    });
  });

const extractBody = (m) => {
  if (!m) return '';
  const messageType = m.mtype || '';

  try {
    const messageHandlers = {
      conversation: () => m.message?.conversation || '',
      imageMessage: () => m.message?.imageMessage?.caption || '',
      videoMessage: () => m.message?.videoMessage?.caption || '',
      extendedTextMessage: () => m.message?.extendedTextMessage?.text || '',
      buttonsResponseMessage: () => m.message?.buttonsResponseMessage?.selectedButtonId || '',
      listResponseMessage: () =>
        m.message?.listResponseMessage?.singleSelectReply?.selectedRowId || '',
      templateButtonReplyMessage: () => m.message?.templateButtonReplyMessage?.selectedId || '',
      interactiveResponseMessage: () => {
        const params = m.msg?.nativeFlowResponseMessage?.paramsJson;
        return params ? JSON.parse(params).id : '';
      },
      messageContextInfo: () =>
        m.message?.buttonsResponseMessage?.selectedButtonId ||
        m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
        m.text ||
        '',
    };

    return messageHandlers[messageType]?.() || m.text || '';
  } catch (error) {
    colorLog('ERROR', `Failed to extract body: ${error.message}`);
    return '';
  }
};

// -----------------------------------------------------------------------------
// Command Handler Implementation
// -----------------------------------------------------------------------------
export default async function handler(sock, m, chatUpdate, store) {
  try {
    // Message parsing and validation
    const body = extractBody(m);
    const sender = m.key.fromMe ? sock.user.id.split(":")[0] + "@s.whatsapp.net" ||
              sock.user.id : m.key.participant || m.key.remoteJid;

    const senderNumber = String(sender).split('@')[0];
    const rawBody = typeof m.text === 'string' ? m.text : '';
    const prefix = '.';
    const from = m.key?.remoteJid || '';
    let isGroup = m.chat.endsWith('@g.us');
    let isPrivate = m.chat.endsWith("@s.whatsapp.net");
    const botNumber = (await sock.decodeJid?.(sock.user?.id)) || '';
    const isCmd = body.startsWith(prefix);

    // Command parsing
    const parts = body.trim().split(' ').filter(Boolean);
    const command = isCmd ? (parts[0] || '').slice(prefix.length).toLowerCase() : '';
    const erpiji = isCmd 
  ? { name: (parts[0] || '').slice(prefix.length).toLowerCase() }
  : null;
    const args = parts.slice(1);
    const pushname = m.pushName || 'No Name';
    const xample = (cmd) => `*# Format Command Salah:*`;
    const text = args.join(' ');

    // Group metadata extraction
    const groupMetadata = isGroup ? await sock.groupMetadata?.(m.chat).catch(() => ({})) : {};
    const participants = (groupMetadata?.participants || []).map((p) => ({
      id: p.id,
      jid: p.jid,
      admin: p.admin,
      raw: p,
    }));

    const groupOwner = participants.find((p) => p.admin === 'superadmin')?.jid || '';
    const groupAdmins = participants
      .filter((p) => ['admin', 'superadmin'].includes(p.admin))
      .map((p) => p.jid || p.id);

    const isBotAdmin = isGroup ? groupAdmins.includes(botNumber) : false;
    const isAdmin = isGroup ? groupAdmins.includes(m.sender) : false;
    const isGroupOwner = isGroup ? groupOwner === m.sender : false;
    
    let groupCommandR = []

    // Command logging
    if (isCmd) {
      colorLog(
        'COMMAND',
        `
╔══════════════════════════════════╗
║           COMMAND LOG            ║
╠══════════════════════════════════╣
║ Tanggal  : ${ANSI.cyan}${now()}${ANSI.reset}
║ Command  : ${ANSI.green}${command}${ANSI.reset}
║ Pengirim : ${ANSI.yellow}${pushname}${ANSI.reset}
║ JID      : ${ANSI.white}${senderNumber}${ANSI.reset}
║ Tipe     : ${ANSI.cyan}${isGroup ? 'GROUP' : 'PRIVATE'}${ANSI.reset}
╚══════════════════════════════════╝
            `.trim(),
      );
    }

    // Command router
    switch (command) {
          case 'register': {
        if (!text) {
            return sock.sendMessage(m.chat, {
                text: `*# Format Salah:* .register nama\n*Contoh:* .register ${pushname}\n\nKlik tombol dibawah untuk verifikasi otomatis.`,
                footer: "Shanks - WhatsApp Bot 2025",
                buttons: [
                    { buttonId: ".verify", buttonText: { displayText: "Register Otomatis" }, type: 1 }
                ]
            }, { quoted: m });
        }
        
        try {
            const existingUser = RPGSystem.findUser(m.sender);
            if (existingUser) {
                return sock.sendMessage(m.chat, {
                    text: `❌ *Kamu sudah terdaftar!*\n\nNama: ${existingUser.name}\nLevel: ${existingUser.level}\nRace: ${RPGSystem.config.races[existingUser.race]?.name || existingUser.race}`,
                    footer: "Shanks - WhatsApp Bot 2025"
                }, { quoted: m });
            }
            
            await RPGSystem.createUser(m.sender, text.toLowerCase());
            
            const userProfile = RPGSystem.getProfile(m.sender);
            const raceInfo = RPGSystem.getRace(m.sender);
            
            await sock.sendMessage(m.chat, {
                text: `🎉 *REGISTRASI BERHASIL!*\n\n` +
                      `👤 *Nama:* ${userProfile.name}\n` +
                      `⭐ *Level:* ${userProfile.level}\n` +
                      `🏆 *Race:* ${raceInfo.name} ${raceInfo.version}\n` +
                      `💫 *Ability:* ${raceInfo.bonuses.passive || 'No passive'}\n` +
                      `💎 *EXP:* ${userProfile.exp}/${userProfile.nextLevelExp}\n` +
                      `💰 *Money:* ${userProfile.money} Gold\n\n` +
                      `_Selamat bergabung di dunia RPG!_`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
            
        } catch (error) {
            await sock.sendMessage(m.chat, {
                text: `❌ *Error:* ${error.message}`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }
        break;
    }

    case 'verify': {
        try {
            const existingUser = RPGSystem.findUser(m.sender);
            if (existingUser) {
                return sock.sendMessage(m.chat, {
                    text: `❌ *Kamu sudah terdaftar!*\n\nNama: ${existingUser.name}\nLevel: ${existingUser.level}`,
                    footer: "Shanks - WhatsApp Bot 2025"
                }, { quoted: m });
            }
            
            const autoName = pushname.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'player_' + Math.random().toString(36).substr(2, 5);
            await RPGSystem.createUser(m.sender, autoName);
            
            const userProfile = RPGSystem.getProfile(m.sender);
            const raceInfo = RPGSystem.getRace(m.sender);
            
            await sock.sendMessage(m.chat, {
                text: `✅ *VERIFIKASI OTOMATIS BERHASIL!*\n\n` +
                      `👤 *Nama:* ${userProfile.name}\n` +
                      `⭐ *Level:* ${userProfile.level}\n` +
                      `🏆 *Race:* ${raceInfo.name} ${raceInfo.version}\n` +
                      `💫 *Ability:* ${raceInfo.bonuses.passive || 'No passive'}\n` +
                      `💎 *EXP:* ${userProfile.exp}/${userProfile.nextLevelExp}\n` +
                      `💰 *Money:* ${userProfile.money} Gold\n\n` +
                      `_Selamat bermain! Gunakan .profile untuk melihat stat lengkap._`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
            
        } catch (error) {
            await sock.sendMessage(m.chat, {
                text: `❌ *Error verifikasi:* ${error.message}`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }
        break;
    }
      case 'menu': {
        let title = `Hai @${m.sender.split('@')[0]} ~Perkenalkan Saya Adalah Shanks WhatsApp Bot`;
        sock.sendMessage(m.chat, { text: title }, { quoted: m });
        break;
      }

      case 'ping': {
        const up = Math.floor(process.uptime());
        const h = Math.floor(up / 3600);
        const m = Math.floor((up % 3600) / 60);
        const s = up % 60;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const ramPct = ((usedMem / totalMem) * 100).toFixed(2);
        const cpu = (os.cpus()[0] && os.cpus()[0].model) || 'Unknown';
        const cores = os.cpus().length || 1;
        const node = process.version;
        const plat = os.platform();
        const host = os.hostname();
        const latency = Date.now() - m.messageTimestamp * 1000;

        const text = `
╔══════════════════════════════╗
║         ⚡ 𝗕𝗢𝗧 𝗦𝗧𝗔𝗧𝗨𝗦 ⚡      ║
╚══════════════════════════════╝

⏰ 𝗥𝘂𝗻𝘁𝗶𝗺𝗲    : ⏱ ${h}h ${m}m ${s}s
🖥️ 𝗣𝗹𝗮𝘁𝗳𝗼𝗿𝗺   : ${plat} 💠
⚡ 𝗖𝗣𝗨       : ${cpu} (${cores} core) 🖤
🧠 𝗥𝗔𝗠       : ${(usedMem / 1024 / 1024).toFixed(2)} MB / ${(totalMem / 1024 / 1024).toFixed(2)} MB (${ramPct}%)
📦 𝗡𝗼𝗱𝗲.𝗷𝘀   : ${node} 📦
🏠 𝗛𝗼𝘀𝘁𝗻𝗮𝗺𝗲  : ${host} 🏠
👤 𝗦𝗲𝗻𝗱𝗲𝗿    : ${sender} 👤
📝 𝗡𝗮𝗺𝗲      : ${name} ✍️

🚀 𝗣𝗶𝗻𝗴      : ${latency} ms ⚡
🎯 𝗕𝗼𝘁 𝘀𝗶𝗮𝗽 𝗱𝗶𝗴𝘂𝗻𝗮𝗸𝗮𝗻! ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        await sock.sendMessage(m.chat, { text }, { quoted: m });
        break;
      }

      default:
        if (body.startsWith('§')) {
          const ownerJid = `${config.owner}@s.whatsapp.net`;
          if (m.sender !== ownerJid) return;
          let kode = body.trim().split(/ +/)[0]
let teks
try {
teks = await eval(`(async () => { ${kode == ">>" ? "return" : ""} ${q}})()`)
} catch (e) {
  m.reply(e)
}
        }
    }

// Handle erpiji commands (group commands)
if (erpiji) {
  if (!isGroup) {
      return sock.sendMessage(m.chat, {
        text: "⚠️ Fitur RPG hanya tersedia untuk grup. Silakan gabung ke grup untuk menggunakan fitur ini.",
        footer: "Shanks - Whatsapp Bot 2025"
      }, { quoted: m });
  }

  // Cek apakah user sudah terdaftar
  const userExists = RPGSystem.findUser(m.sender);

  if (!userExists) {
    return sock.sendMessage(m.chat, {
      image: { url: "https://raw.githubusercontent.com/RullzFuqi/db/main/shanks_img/(2)%20WRE%20%EC%99%93%EC%8A%A8%26Whatson%20on%20X_.jpeg" },
      caption: `Hai Kak *${pushname}* Anda Belum Mendaftar Untuk Fitur Rpg. Silahkan Ketik *.register nama* Atau Klik Tombol Dibawah Untuk Verify Otomatis`,
      footer: "Shanks - WhatsApp Bot 2025",
      contextInfo: {
        isForwarded: true,
        forwardedNewsletterMessage: { newsletterName: "Lihat Saluran", newsletterJid: "120363393144098629@newsletter" },
        externalAdReply: {
          thumbnail: fs.readFileSync("./thumbnail/shanks2.jpeg"),
          sourceUrl: "https://whatsapp.com/channel/0029Vb3MRYr65yDKC5pT0Z2F",
          title: "Shanks - Wabot 2025",
          body: "",
          mediaType: 2,
          showAdAttribution: true
        }
      },
      buttons: [{ buttonId: ".verify", buttonText: { displayText: "Verifikasi Otomatis" }, type: 1 }],
    }, { quoted: m });
  }

    // User sudah terdaftar, proses command
    switch (erpiji.name) {
        case 'profile': {
            try {
                const profile = RPGSystem.getProfile(m.sender);
                const raceInfo = RPGSystem.getRace(m.sender);
                const nextLevelExp = RPGSystem.requiredExp(profile.level + 1);
                const expProgress = ((profile.exp / nextLevelExp) * 100).toFixed(1);

                // Buat progress bar
                const progressBar = (percentage) => {
                    const bars = 20;
                    const filled = Math.round((percentage / 100) * bars);
                    const empty = bars - filled;
                    return '█'.repeat(filled) + '░'.repeat(empty);
                };

                await sock.sendMessage(
                    m.chat,
                    {
                        text:
                            `👤 *PROFILE RPG - ${profile.name.toUpperCase()}*\n\n` +
                            `⭐ *Level:* ${profile.level}\n` +
                            `💎 *EXP:* ${profile.exp}/${nextLevelExp}\n` +
                            `📊 *Progress:* ${expProgress}%\n` +
                            `   ${progressBar(expProgress)}\n\n` +
                            `🏆 *Race:* ${raceInfo.name} ${raceInfo.version}\n` +
                            `💫 *Passive:* ${raceInfo.bonuses.passive || 'No passive'}\n` +
                            `⚡ *Special:* ${raceInfo.bonuses.special_ability || 'No special ability'}\n\n` +
                            `❤️ *Health:* ${profile.stats.health}\n` +
                            `⚔️ *Attack:* ${profile.stats.attack}\n` +
                            `🛡️ *Defense:* ${profile.stats.defense}\n` +
                            `🏃 *Speed:* ${profile.stats.speed}\n\n` +
                            `💰 *Money:* ${profile.money} Gold\n` +
                            `📅 *Bergabung:* ${new Date(profile.createdAt).toLocaleDateString('id-ID')}`,
                        footer: 'Shanks - WhatsApp Bot 2025',
                    },
                    { quoted: m },
                );
            } catch (error) {
                await sock.sendMessage(
                    m.chat,
                    {
                        text: `❌ *Error:* ${error.message}`,
                        footer: 'Shanks - WhatsApp Bot 2025',
                    },
                    { quoted: m },
                );
            }
            break;
        }

        case 'inventory': {
            try {
                const user = RPGSystem.findUser(m.sender);
                const inventory = RPGSystem.getInventory(m.sender);
                let inventoryText = `🎒 *INVENTORY - ${user.name.toUpperCase()}*\n\n`;

                // Tampilkan item yang dimiliki (hanya yang quantity > 0)
                let hasItems = false;

                for (const [category, items] of Object.entries(inventory)) {
                    const categoryItems = Object.entries(items)
                        .filter(([item, qty]) => qty > 0)
                        .map(
                            ([item, qty]) => `  • ${RPGSystem.items[category]?.[item]?.name || item}: ${qty}x`,
                        )
                        .join('\n');

                    if (categoryItems) {
                        inventoryText += `📦 *${category.toUpperCase()}:*\n${categoryItems}\n\n`;
                        hasItems = true;
                    }
                }

                if (!hasItems) {
                    inventoryText += `📭 *Inventory kosong*\n_Gunakan .hunt atau .work untuk mendapatkan item!_`;
                }

                // Tampilkan equipment
                const equipment = RPGSystem.getEquipment(m.sender);
                inventoryText += `⚔️ *EQUIPPED:*\n`;
                inventoryText += `  • Weapon: ${equipment.weapon ? RPGSystem.items.weapon[equipment.weapon]?.name || equipment.weapon : 'Tidak ada'}\n`;
                inventoryText += `  • Armor: ${equipment.armor ? RPGSystem.items.armor[equipment.armor]?.name || equipment.armor : 'Tidak ada'}\n`;
                inventoryText += `  • Accessory: ${equipment.accessory ? RPGSystem.items.accessory[equipment.accessory]?.name || equipment.accessory : 'Tidak ada'}`;

                await sock.sendMessage(
                    m.chat,
                    {
                        text: inventoryText,
                        footer: 'Shanks - WhatsApp Bot 2025',
                    },
                    { quoted: m },
                );
            } catch (error) {
                await sock.sendMessage(
                    m.chat,
                    {
                        text: `❌ *Error:* ${error.message}`,
                        footer: 'Shanks - WhatsApp Bot 2025',
                    },
                    { quoted: m },
                );
            }
            break;
        }

        case 'leaderboard': {
            try {
                const criteria = args[0] || 'level';
                const leaderboard = RPGSystem.getLeaderboard(criteria, 10);

                if (leaderboard.length === 0) {
                    return sock.sendMessage(
                        m.chat,
                        {
                            text: `📊 *LEADERBOARD*\n\nBelum ada pemain yang terdaftar!`,
                            footer: 'Shanks - WhatsApp Bot 2025',
                        },
                        { quoted: m },
                    );
                }

                let leaderboardText = `🏆 *LEADERBOARD - ${criteria.toUpperCase()}*\n\n`;

                leaderboard.forEach((player, index) => {
                    const medal =
                        index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    leaderboardText += `${medal} ${player.name}\n`;
                    leaderboardText += `   Level: ${player.level} | EXP: ${player.exp} | Money: ${player.money}\n`;
                    leaderboardText += `   Race: ${RPGSystem.config.races[player.race]?.name || player.race}\n\n`;
                });

                // Cari ranking user yang sedang melihat
                const allUsers = RPGSystem.getLeaderboard(criteria, 1000);
                const currentUser = RPGSystem.findUser(m.sender);
                const userRank =
                    allUsers.findIndex((p) => p.name === currentUser?.name) + 1;

                if (userRank > 0) {
                    leaderboardText += `📊 *Ranking kamu:* #${userRank}`;
                }

                await sock.sendMessage(
                    m.chat,
                    {
                        text: leaderboardText,
                        footer: 'Shanks - WhatsApp Bot 2025',
                    },
                    { quoted: m },
                );
            } catch (error) {
                await sock.sendMessage(
                    m.chat,
                    {
                        text: `❌ *Error:* ${error.message}`,
                        footer: 'Shanks - WhatsApp Bot 2025',
                    },
                    { quoted: m },
                );
            }
            break;
        }

        // Tambahkan case-case RPG lainnya di sini...
// Di bagian handler message.js, tambahkan case-case berikut:

case 'hunt': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'hunt');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nHunt lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.updateStatsOverTime(m.sender);
        await RPGSystem.consumeStamina(m.sender, 15);
        await RPGSystem.consumeHunger(m.sender, 5);

        const expGained = Math.floor(Math.random() * 50) + 10;
        const moneyGained = Math.floor(Math.random() * 100) + 20;
        
        const result = await RPGSystem.addExp(m.sender, expGained);
        await RPGSystem.addMoney(m.sender, moneyGained);
        
        // Random item drop
        const items = ['wood', 'stone', 'leather', 'cloth'];
        const randomItem = items[Math.floor(Math.random() * items.length)];
        await RPGSystem.addItem(m.sender, 'material', randomItem, 1);
        
        await RPGSystem.setCooldown(m.sender, 'hunt');
        
        let huntText = `🎯 *HUNTING RESULT*\n\n`;
        huntText += `💎 EXP: +${expGained}\n`;
        huntText += `💰 Money: +${moneyGained} Gold\n`;
        huntText += `🎒 Item: ${RPGSystem.items.material[randomItem]?.name || randomItem}\n`;
        huntText += `💪 Stamina: -15\n🍖 Hunger: -5\n`;
        
        if (result.leveledUp) {
            huntText += `\n🎉 *LEVEL UP!* Sekarang level ${result.level}`;
        }
        
        await sock.sendMessage(m.chat, { text: huntText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'work': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'work');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nWork lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.updateStatsOverTime(m.sender);
        await RPGSystem.consumeStamina(m.sender, 20);
        await RPGSystem.consumeHunger(m.sender, 8);

        const moneyGained = Math.floor(Math.random() * 200) + 50;
        const expGained = Math.floor(Math.random() * 30) + 5;
        
        await RPGSystem.addMoney(m.sender, moneyGained);
        const result = await RPGSystem.addExp(m.sender, expGained);
        await RPGSystem.setCooldown(m.sender, 'work');
        
        let workText = `💼 *WORK RESULT*\n\n`;
        workText += `💰 Money: +${moneyGained} Gold\n`;
        workText += `💎 EXP: +${expGained}\n`;
        workText += `💪 Stamina: -20\n🍖 Hunger: -8\n`;
        
        if (result.leveledUp) {
            workText += `\n🎉 *LEVEL UP!* Sekarang level ${result.level}`;
        }
        
        await sock.sendMessage(m.chat, { text: workText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'mine': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'mine');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nMine lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.updateStatsOverTime(m.sender);
        await RPGSystem.consumeStamina(m.sender, 25);
        await RPGSystem.consumeHunger(m.sender, 10);

        const expGained = Math.floor(Math.random() * 40) + 20;
        const result = await RPGSystem.addExp(m.sender, expGained);
        await RPGSystem.addSkillExp(m.sender, 'mining');
        
        // Mining drops
        const ores = ['coal', 'iron', 'copper', 'silver', 'gold'];
        const weights = [40, 30, 20, 8, 2]; // Probabilities
        let random = Math.random() * 100;
        let minedOre = 'coal';
        
        for (let i = 0; i < ores.length; i++) {
            if (random < weights[i]) {
                minedOre = ores[i];
                break;
            }
            random -= weights[i];
        }
        
        const quantity = Math.floor(Math.random() * 3) + 1;
        await RPGSystem.addItem(m.sender, 'ore', minedOre, quantity);
        await RPGSystem.setCooldown(m.sender, 'mine');
        
        let mineText = `⛏️ *MINING RESULT*\n\n`;
        mineText += `💎 EXP: +${expGained}\n`;
        mineText += `🪨 Mined: ${RPGSystem.items.ore[minedOre]?.name || minedOre} x${quantity}\n`;
        mineText += `📈 Mining Skill: +1\n`;
        mineText += `💪 Stamina: -25\n🍖 Hunger: -10\n`;
        
        if (result.leveledUp) {
            mineText += `\n🎉 *LEVEL UP!* Sekarang level ${result.level}`;
        }
        
        await sock.sendMessage(m.chat, { text: mineText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'fish': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'fish');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nFishing lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.updateStatsOverTime(m.sender);
        await RPGSystem.consumeStamina(m.sender, 15);
        await RPGSystem.consumeHunger(m.sender, 5);

        const expGained = Math.floor(Math.random() * 35) + 15;
        const result = await RPGSystem.addExp(m.sender, expGained);
        await RPGSystem.addSkillExp(m.sender, 'fishing');
        
        // Fishing drops
        const fishTypes = ['fish', 'fish', 'fish', 'fish', 'gold_ring']; // fish more common
        const caughtItem = fishTypes[Math.floor(Math.random() * fishTypes.length)];
        const quantity = caughtItem === 'fish' ? Math.floor(Math.random() * 3) + 1 : 1;
        
        const category = caughtItem === 'fish' ? 'food' : 'accessory';
        await RPGSystem.addItem(m.sender, category, caughtItem, quantity);
        await RPGSystem.setCooldown(m.sender, 'fish');
        
        let fishText = `🎣 *FISHING RESULT*\n\n`;
        fishText += `💎 EXP: +${expGained}\n`;
        fishText += `🐟 Caught: ${RPGSystem.items[category]?.[caughtItem]?.name || caughtItem} x${quantity}\n`;
        fishText += `📈 Fishing Skill: +1\n`;
        fishText += `💪 Stamina: -15\n🍖 Hunger: -5\n`;
        
        if (result.leveledUp) {
            fishText += `\n🎉 *LEVEL UP!* Sekarang level ${result.level}`;
        }
        
        await sock.sendMessage(m.chat, { text: fishText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'chop': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'chop');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nChop lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.updateStatsOverTime(m.sender);
        await RPGSystem.consumeStamina(m.sender, 20);
        await RPGSystem.consumeHunger(m.sender, 8);

        const expGained = Math.floor(Math.random() * 30) + 10;
        const result = await RPGSystem.addExp(m.sender, expGained);
        await RPGSystem.addSkillExp(m.sender, 'woodcutting');
        
        const woodGained = Math.floor(Math.random() * 5) + 2;
        await RPGSystem.addItem(m.sender, 'material', 'wood', woodGained);
        await RPGSystem.setCooldown(m.sender, 'chop');
        
        let chopText = `🪓 *WOODCUTTING RESULT*\n\n`;
        chopText += `💎 EXP: +${expGained}\n`;
        chopText += `🪵 Wood: +${woodGained}\n`;
        chopText += `📈 Woodcutting Skill: +1\n`;
        chopText += `💪 Stamina: -20\n🍖 Hunger: -8\n`;
        
        if (result.leveledUp) {
            chopText += `\n🎉 *LEVEL UP!* Sekarang level ${result.level}`;
        }
        
        await sock.sendMessage(m.chat, { text: chopText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'eat': {
    try {
        const item = args[0]?.toLowerCase();
        if (!item) {
            return sock.sendMessage(m.chat, {
                text: `*Format:* .eat <item>\n*Contoh:* .eat bread\n\n*Available food:*\n${Object.keys(RPGSystem.items.food || {}).map(f => `• ${f}`).join('\n')}`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const effects = await RPGSystem.useItem(m.sender, 'food', item, 1);
        
        let eatText = `🍽️ *EATING RESULT*\n\n`;
        eatText += `🍖 Ate: ${RPGSystem.items.food[item]?.name || item}\n`;
        
        if (effects.hunger) eatText += `🍖 Hunger: +${effects.hunger}\n`;
        if (effects.energy) eatText += `⚡ Energy: +${effects.energy}\n`;
        if (effects.health) eatText += `❤️ Health: +${effects.health}\n`;
        
        await sock.sendMessage(m.chat, { text: eatText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'drink': {
    try {
        const item = args[0]?.toLowerCase();
        if (!item) {
            return sock.sendMessage(m.chat, {
                text: `*Format:* .drink <item>\n*Contoh:* .drink water\n\n*Available drinks:*\n${Object.keys(RPGSystem.items.drink || {}).map(d => `• ${d}`).join('\n')}`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const effects = await RPGSystem.useItem(m.sender, 'drink', item, 1);
        
        let drinkText = `🥤 *DRINKING RESULT*\n\n`;
        drinkText += `🧃 Drank: ${RPGSystem.items.drink[item]?.name || item}\n`;
        
        if (effects.energy) drinkText += `⚡ Energy: +${effects.energy}\n`;
        if (effects.stamina) drinkText += `💪 Stamina: +${effects.stamina}\n`;
        if (effects.health) drinkText += `❤️ Health: +${effects.health}\n`;
        
        await sock.sendMessage(m.chat, { text: drinkText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'use': {
    try {
        const item = args[0]?.toLowerCase();
        if (!item) {
            return sock.sendMessage(m.chat, {
                text: `*Format:* .use <item>\n*Contoh:* .use health_potion\n\n*Available potions:*\n${Object.keys(RPGSystem.items.potion || {}).map(p => `• ${p}`).join('\n')}`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const effects = await RPGSystem.useItem(m.sender, 'potion', item, 1);
        
        let useText = `🧪 *POTION USED*\n\n`;
        useText += `⚗️ Used: ${RPGSystem.items.potion[item]?.name || item}\n`;
        
        if (effects.health) useText += `❤️ Health: +${effects.health}\n`;
        
        await sock.sendMessage(m.chat, { text: useText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'equip': {
    try {
        const [category, item] = args;
        if (!category || !item) {
            return sock.sendMessage(m.chat, {
                text: `*Format:* .equip <category> <item>\n*Contoh:* .equip weapon iron_sword\n\n*Categories:* weapon, armor, accessory`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const equipment = await RPGSystem.equipItem(m.sender, category, item);
        
        let equipText = `⚔️ *EQUIPMENT UPDATED*\n\n`;
        equipText += `✅ Equipped: ${RPGSystem.items[category]?.[item]?.name || item}\n`;
        equipText += `📦 Category: ${category}\n\n`;
        equipText += `*Current Equipment:*\n`;
        equipText += `• Weapon: ${equipment.weapon || 'None'}\n`;
        equipText += `• Armor: ${equipment.armor || 'None'}\n`;
        equipText += `• Accessory: ${equipment.accessory || 'None'}`;
        
        await sock.sendMessage(m.chat, { text: equipText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'craft': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'craft');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nCraft lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const item = args[0]?.toLowerCase();
        if (!item) {
            return sock.sendMessage(m.chat, {
                text: `*Format:* .craft <item>\n*Contoh:* .craft iron_sword\n\n*Available recipes:*\n• iron_sword (3 iron_bar)\n• steel_sword (5 steel_bar)\n• health_potion (2 magic_dust)`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.updateStatsOverTime(m.sender);
        await RPGSystem.consumeStamina(m.sender, 10);
        await RPGSystem.consumeHunger(m.sender, 3);

        let category = 'weapon';
        if (item.includes('potion')) category = 'potion';
        
        const craftedItem = await RPGSystem.craftItem(m.sender, item, category);
        await RPGSystem.setCooldown(m.sender, 'craft');
        
        let craftText = `🔨 *CRAFTING SUCCESS*\n\n`;
        craftText += `🛠️ Crafted: ${RPGSystem.items[category]?.[craftedItem]?.name || craftedItem}\n`;
        craftText += `📈 Crafting Skill: +1\n`;
        craftText += `💪 Stamina: -10\n🍖 Hunger: -3\n`;
        
        await sock.sendMessage(m.chat, { text: craftText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'travel': {
    try {
        const location = args[0]?.toLowerCase();
        if (!location) {
            return sock.sendMessage(m.chat, {
                text: `*Format:* .travel <location>\n*Contoh:* .travel forest\n\n*Available locations:*\n• village (Level 1)\n• forest (Level 5)\n• mine (Level 10)\n• mountain (Level 15)\n• dungeon (Level 20)\n• city (Level 25)`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const newLocation = await RPGSystem.travel(m.sender, location);
        
        await sock.sendMessage(m.chat, {
            text: `✈️ *TRAVEL SUCCESS*\n\n📍 You arrived at: ${newLocation.toUpperCase()}\n🌍 Now exploring new areas!`,
            footer: "Shanks - WhatsApp Bot 2025"
        }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'skills': {
    try {
        const skills = RPGSystem.getSkills(m.sender);
        
        let skillsText = `🎯 *SKILLS PROFILE*\n\n`;
        Object.entries(skills).forEach(([skill, level]) => {
            skillsText += `• ${skill.charAt(0).toUpperCase() + skill.slice(1)}: Level ${level}\n`;
        });
        
        await sock.sendMessage(m.chat, { text: skillsText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'rest': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'rest');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nRest lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.restoreStats(m.sender, {
            stamina: 50,
            energy: 30,
            health: 20
        });
        
        await RPGSystem.setCooldown(m.sender, 'rest');
        
        await sock.sendMessage(m.chat, {
            text: `💤 *RESTING COMPLETE*\n\n💪 Stamina: +50\n⚡ Energy: +30\n❤️ Health: +20\n\n_You feel refreshed and ready for adventure!_`,
            footer: "Shanks - WhatsApp Bot 2025"
        }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'explore': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'explore');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nExplore lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.updateStatsOverTime(m.sender);
        await RPGSystem.consumeStamina(m.sender, 30);
        await RPGSystem.consumeHunger(m.sender, 15);

        const expGained = Math.floor(Math.random() * 100) + 50;
        const moneyGained = Math.floor(Math.random() * 300) + 100;
        const result = await RPGSystem.addExp(m.sender, expGained);
        await RPGSystem.addMoney(m.sender, moneyGained);
        
        // Random discovery
        const discoveries = [
            { type: 'item', item: 'magic_dust', category: 'material', quantity: 2 },
            { type: 'item', item: 'gold_ring', category: 'accessory', quantity: 1 },
            { type: 'money', amount: 500 },
            { type: 'exp', amount: 100 }
        ];
        
        const discovery = discoveries[Math.floor(Math.random() * discoveries.length)];
        let discoveryText = '';
        
        if (discovery.type === 'item') {
            await RPGSystem.addItem(m.sender, discovery.category, discovery.item, discovery.quantity);
            discoveryText = `🎁 Found: ${RPGSystem.items[discovery.category]?.[discovery.item]?.name || discovery.item} x${discovery.quantity}`;
        } else if (discovery.type === 'money') {
            await RPGSystem.addMoney(m.sender, discovery.amount);
            discoveryText = `💰 Found: ${discovery.amount} Gold`;
        } else {
            await RPGSystem.addExp(m.sender, discovery.amount);
            discoveryText = `💎 Found: ${discovery.amount} EXP`;
        }
        
        await RPGSystem.setCooldown(m.sender, 'explore');
        
        let exploreText = `🗺️ *EXPLORATION RESULT*\n\n`;
        exploreText += `💎 EXP: +${expGained}\n`;
        exploreText += `💰 Money: +${moneyGained}\n`;
        exploreText += `${discoveryText}\n`;
        exploreText += `💪 Stamina: -30\n🍖 Hunger: -15\n`;
        
        if (result.leveledUp) {
            exploreText += `\n🎉 *LEVEL UP!* Sekarang level ${result.level}`;
        }
        
        await sock.sendMessage(m.chat, { text: exploreText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'duel': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'duel');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nDuel lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.updateStatsOverTime(m.sender);
        await RPGSystem.consumeStamina(m.sender, 40);
        await RPGSystem.consumeHunger(m.sender, 20);

        const expGained = Math.floor(Math.random() * 80) + 40;
        const moneyGained = Math.floor(Math.random() * 200) + 100;
        const result = await RPGSystem.addExp(m.sender, expGained);
        await RPGSystem.addMoney(m.sender, moneyGained);
        await RPGSystem.addSkillExp(m.sender, 'combat');
        
        // Simulate duel outcome
        const win = Math.random() > 0.3; // 70% win rate
        await RPGSystem.setCooldown(m.sender, 'duel');
        
        let duelText = `⚔️ *DUEL RESULT*\n\n`;
        if (win) {
            duelText += `🏆 *VICTORY!* You defeated your opponent!\n`;
            duelText += `💎 EXP: +${expGained}\n`;
            duelText += `💰 Money: +${moneyGained}\n`;
            duelText += `📈 Combat Skill: +1\n`;
        } else {
            duelText += `💔 *DEFEAT!* You were defeated in battle!\n`;
            duelText += `💎 EXP: +${Math.floor(expGained/2)}\n`;
            // Lose some money when defeated
            await RPGSystem.minMoney(m.sender, Math.floor(moneyGained/2));
            duelText += `💰 Money Lost: -${Math.floor(moneyGained/2)}\n`;
        }
        
        duelText += `💪 Stamina: -40\n🍖 Hunger: -20\n`;
        
        if (result.leveledUp) {
            duelText += `\n🎉 *LEVEL UP!* Sekarang level ${result.level}`;
        }
        
        await sock.sendMessage(m.chat, { text: duelText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'gamble': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'gamble');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nGamble lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const amount = parseInt(args[0]) || 100;
        if (amount < 10) {
            return sock.sendMessage(m.chat, {
                text: `❌ Minimum bet is 10 gold!`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const userMoney = RPGSystem.getMoney(m.sender);
        if (userMoney < amount) {
            return sock.sendMessage(m.chat, {
                text: `❌ You don't have enough gold!`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const win = Math.random() > 0.5; // 50% chance
        await RPGSystem.setCooldown(m.sender, 'gamble');
        
        let gambleText = `🎰 *GAMBLING RESULT*\n\n`;
        gambleText += `💰 Bet: ${amount} Gold\n`;
        
        if (win) {
            const winAmount = amount * 2;
            await RPGSystem.addMoney(m.sender, winAmount);
            gambleText += `🎉 *JACKPOT!* You won ${winAmount} Gold!\n`;
            gambleText += `💰 Total: +${amount} Gold`;
        } else {
            await RPGSystem.minMoney(m.sender, amount);
            gambleText += `💔 *You lost!* Better luck next time!\n`;
            gambleText += `💰 Total: -${amount} Gold`;
        }
        
        await sock.sendMessage(m.chat, { text: gambleText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'shop': {
    try {
        const category = args[0]?.toLowerCase();
        if (!category) {
            let shopText = `🛒 *RPG SHOP*\n\n`;
            shopText += `*Categories:*\n`;
            shopText += `• weapon - Weapons for battle\n`;
            shopText += `• armor - Armor for defense\n`;
            shopText += `• potion - Healing potions\n`;
            shopText += `• food - Food items\n`;
            shopText += `• drink - Drink items\n`;
            shopText += `• tool - Mining tools\n`;
            shopText += `• material - Crafting materials\n\n`;
            shopText += `*Usage:* .shop <category>`;
            
            return sock.sendMessage(m.chat, { text: shopText }, { quoted: m });
        }

        if (!RPGSystem.items[category]) {
            return sock.sendMessage(m.chat, {
                text: `❌ Category not found! Use .shop to see available categories.`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        let shopText = `🛒 *SHOP - ${category.toUpperCase()}*\n\n`;
        Object.entries(RPGSystem.items[category]).forEach(([itemKey, item]) => {
            shopText += `• ${item.name}: ${item.price_buy} Gold\n`;
        });
        
        shopText += `\n*Usage:* .buy ${category} <item>`;
        
        await sock.sendMessage(m.chat, { text: shopText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'buy': {
    try {
        const [category, item] = args;
        if (!category || !item) {
            return sock.sendMessage(m.chat, {
                text: `*Format:* .buy <category> <item>\n*Contoh:* .buy weapon iron_sword\n\nUse .shop to see available items.`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const itemData = RPGSystem.items[category]?.[item];
        if (!itemData) {
            return sock.sendMessage(m.chat, {
                text: `❌ Item not found!`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.minMoney(m.sender, itemData.price_buy);
        await RPGSystem.addItem(m.sender, category, item, 1);
        
        await sock.sendMessage(m.chat, {
            text: `🛒 *PURCHASE SUCCESS*\n\n✅ Bought: ${itemData.name}\n💰 Cost: ${itemData.price_buy} Gold\n📦 Added to inventory!`,
            footer: "Shanks - WhatsApp Bot 2025"
        }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'sell': {
    try {
        const [category, item, quantity = 1] = args;
        if (!category || !item) {
            return sock.sendMessage(m.chat, {
                text: `*Format:* .sell <category> <item> [quantity]\n*Contoh:* .sell ore coal 5`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const itemData = RPGSystem.items[category]?.[item];
        if (!itemData) {
            return sock.sendMessage(m.chat, {
                text: `❌ Item not found!`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        const qty = parseInt(quantity);
        await RPGSystem.removeItem(m.sender, category, item, qty);
        const totalValue = itemData.price_sell * qty;
        await RPGSystem.addMoney(m.sender, totalValue);
        
        await sock.sendMessage(m.chat, {
            text: `💰 *SALE SUCCESS*\n\n✅ Sold: ${itemData.name} x${qty}\n💰 Earned: ${totalValue} Gold`,
            footer: "Shanks - WhatsApp Bot 2025"
        }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'train': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'train');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nTrain lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.updateStatsOverTime(m.sender);
        await RPGSystem.consumeStamina(m.sender, 35);
        await RPGSystem.consumeHunger(m.sender, 15);

        const expGained = Math.floor(Math.random() * 60) + 30;
        const result = await RPGSystem.addExp(m.sender, expGained);
        await RPGSystem.addSkillExp(m.sender, 'combat');
        
        // Small chance to find training equipment
        let bonusText = '';
        if (Math.random() < 0.1) { // 10% chance
            await RPGSystem.addItem(m.sender, 'material', 'iron_bar', 1);
            bonusText = `\n🎁 Found: Iron Bar x1 during training!`;
        }
        
        await RPGSystem.setCooldown(m.sender, 'train');
        
        let trainText = `💪 *TRAINING RESULT*\n\n`;
        trainText += `💎 EXP: +${expGained}\n`;
        trainText += `📈 Combat Skill: +1\n`;
        trainText += `💪 Stamina: -35\n🍖 Hunger: -15\n`;
        trainText += bonusText;
        
        if (result.leveledUp) {
            trainText += `\n🎉 *LEVEL UP!* Sekarang level ${result.level}`;
        }
        
        await sock.sendMessage(m.chat, { text: trainText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'pray': {
    try {
        const cooldown = RPGSystem.checkCooldown(m.sender, 'pray');
        if (cooldown.onCooldown) {
            const remaining = Math.ceil(cooldown.remaining / 1000);
            return sock.sendMessage(m.chat, {
                text: `⏰ *Cooldown Active!*\nPray lagi dalam *${remaining} detik*`,
                footer: "Shanks - WhatsApp Bot 2025"
            }, { quoted: m });
        }

        await RPGSystem.updateStatsOverTime(m.sender);
        await RPGSystem.consumeHunger(m.sender, 5);

        const blessings = [
            { type: 'exp', amount: 50, message: '💫 Divine wisdom grants you EXP!' },
            { type: 'money', amount: 200, message: '💰 The gods bless you with wealth!' },
            { type: 'health', amount: 30, message: '❤️ Holy light restores your health!' },
            { type: 'item', item: 'magic_dust', quantity: 3, message: '✨ Magic dust falls from the heavens!' }
        ];
        
        const blessing = blessings[Math.floor(Math.random() * blessings.length)];
        let prayText = `🙏 *PRAYER ANSWERED*\n\n`;
        
        if (blessing.type === 'exp') {
            await RPGSystem.addExp(m.sender, blessing.amount);
            prayText += `${blessing.message}\n💎 EXP: +${blessing.amount}`;
        } else if (blessing.type === 'money') {
            await RPGSystem.addMoney(m.sender, blessing.amount);
            prayText += `${blessing.message}\n💰 Gold: +${blessing.amount}`;
        } else if (blessing.type === 'health') {
            await RPGSystem.restoreStats(m.sender, { health: blessing.amount });
            prayText += `${blessing.message}\n❤️ Health: +${blessing.amount}`;
        } else if (blessing.type === 'item') {
            await RPGSystem.addItem(m.sender, 'material', blessing.item, blessing.quantity);
            prayText += `${blessing.message}\n🎁 Item: ${blessing.item} x${blessing.quantity}`;
        }
        
        prayText += `\n🍖 Hunger: -5`;
        
        await RPGSystem.setCooldown(m.sender, 'pray');
        await sock.sendMessage(m.chat, { text: prayText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

case 'stats': {
    try {
        const profile = RPGSystem.getProfile(m.sender);
        const stats = profile.stats;
        
        // Create progress bars
        const progressBar = (current, max, length = 10) => {
            const percentage = (current / max) * 100;
            const filled = Math.round((percentage / 100) * length);
            const empty = length - filled;
            return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(percentage)}%`;
        };
        
        let statsText = `📊 *DETAILED STATS - ${profile.name.toUpperCase()}*\n\n`;
        
        statsText += `❤️ *Health:* ${stats.health}/${stats.max_health}\n`;
        statsText += `   ${progressBar(stats.health, stats.max_health)}\n\n`;
        
        statsText += `💪 *Stamina:* ${stats.stamina}/${stats.max_stamina}\n`;
        statsText += `   ${progressBar(stats.stamina, stats.max_stamina)}\n\n`;
        
        statsText += `🍖 *Hunger:* ${stats.hunger}/${stats.max_hunger}\n`;
        statsText += `   ${progressBar(stats.hunger, stats.max_hunger)}\n\n`;
        
        statsText += `⚡ *Energy:* ${stats.energy}/${stats.max_energy}\n`;
        statsText += `   ${progressBar(stats.energy, stats.max_energy)}\n\n`;
        
        statsText += `⚔️ *Attack:* ${stats.attack}\n`;
        statsText += `🛡️ *Defense:* ${stats.defense}\n`;
        statsText += `🏃 *Speed:* ${stats.speed}\n\n`;
        
        statsText += `📍 *Location:* ${profile.location}\n`;
        statsText += `💰 *Money:* ${profile.money} Gold`;
        
        await sock.sendMessage(m.chat, { text: statsText }, { quoted: m });
    } catch (error) {
        await sock.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
    }
    break;
}

// Tambahkan lebih banyak case di sini sesuai kebutuhan...

        default:
            // Jika command tidak dikenali di erpiji
            break;
    }
}
  } catch (error) {
    colorLog(
      'HANDLER_ERROR',
      `
╔══════════════════════════════════╗
║           ERROR REPORT           ║
╠══════════════════════════════════╣
║ Time: ${ANSI.red}${now()}${ANSI.reset}
║ Error: ${ANSI.red}${error.message}${ANSI.reset}
║ Stack: ${ANSI.yellow}${error.stack}${ANSI.reset}
╚══════════════════════════════════╝
        `.trim(),
    );
  }
}

// -----------------------------------------------------------------------------
// File Watcher for Development Hot Reload
// -----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);

fs.watchFile(__filename, () => {
  fs.unwatchFile(__filename);
  colorLog('RELOAD', `${__filename} updated! Hot reloading...`);
  process.exit(0);
});

colorLog('HANDLER', 'Message handler initialized successfully');
