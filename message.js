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
    yellow: `${ESC}[33m`
};

/**
 * Professional logging with colored tags
 * @param {string} tag - Log category tag
 * @param {string} message - Log message content
 */
const colorLog = (tag, message = '') => {
    console.log(`${ANSI.magenta}[${tag}]${ANSI.reset} ${message}`);
};

/**
 * Get formatted current timestamp
 * @returns {string} Formatted datetime string
 */
const now = () => new Date().toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

// -----------------------------------------------------------------------------
// Static Assets Management
// -----------------------------------------------------------------------------
const ASSETS = {
    image: fs.existsSync('./thumbnail/image.jpg') ? 
           fs.readFileSync('./thumbnail/image.jpg') : null,
    docu: fs.existsSync('./thumbnail/document.jpg') ? 
          fs.readFileSync('./thumbnail/document.jpg') : null
};

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Execute shell commands safely
 * @param {string} cmd - Command to execute
 * @returns {Promise<string>} Command output
 */
const exec = cmd => new Promise((resolve, reject) => {
    execCb(cmd, (err, stdout, stderr) => {
        err ? reject(err) : resolve(stdout || stderr || '');
    });
});

/**
 * Extract message body from various message types
 * @param {object} m - Message object
 * @returns {string} Extracted text content
 */
const extractBody = m => {
    if (!m) return '';
    const messageType = m.mtype || '';
    
    try {
        const messageHandlers = {
            conversation: () => m.message?.conversation || '',
            imageMessage: () => m.message?.imageMessage?.caption || '',
            videoMessage: () => m.message?.videoMessage?.caption || '',
            extendedTextMessage: () => m.message?.extendedTextMessage?.text || '',
            buttonsResponseMessage: () => m.message?.buttonsResponseMessage?.selectedButtonId || '',
            listResponseMessage: () => m.message?.listResponseMessage?.singleSelectReply?.selectedRowId || '',
            templateButtonReplyMessage: () => m.message?.templateButtonReplyMessage?.selectedId || '',
            interactiveResponseMessage: () => {
                const params = m.msg?.nativeFlowResponseMessage?.paramsJson;
                return params ? JSON.parse(params).id : '';
            },
            messageContextInfo: () => 
                m.message?.buttonsResponseMessage?.selectedButtonId || 
                m.message?.listResponseMessage?.singleSelectReply?.selectedRowId || 
                m.text || ''
        };

        return messageHandlers[messageType]?.() || m.text || '';
    } catch (error) {
        colorLog('ERROR', `Failed to extract body: ${error.message}`);
        return '';
    }
};

/**
 * Safely send messages with error handling and default ad reply
 * @param {object} sock - Socket instance
 * @param {string} jid - Target JID
 * @param {object|string} payload - Message payload
 * @param {object} quoted - Quoted message reference
 * @returns {Promise<object>} Send result
 */
const safeSend = async (sock, jid, payload, quoted = fquoted?.channel) => {
    const message = typeof payload === 'string' ? { text: payload } : payload;

    // Add advertisement for text messages
    if (message.text) {
        message.contextInfo = {
            ...message.contextInfo,
            externalAdReply: {
                title: config.settings.title,
                body: config.settings.description,
                thumbnailUrl: config.thumbUrl,
                sourceUrl: config.socialMedia?.Telegram || '',
                ...message.contextInfo?.externalAdReply
            }
        };
    }

    try {
        return await sock.sendMessage(jid, message, { quoted });
    } catch (error) {
        colorLog('SEND_ERROR', `Failed to send message: ${error.message}`);
        throw error;
    }
};

// -----------------------------------------------------------------------------
// Command Handler Implementation
// -----------------------------------------------------------------------------

/**
 * Main message handler function
 * @param {object} sock - WhatsApp socket instance
 * @param {object} m - Message object
 * @param {object} chatUpdate - Chat update data
 * @param {object} store - Message store
 */
export default async function handler(sock, m, chatUpdate, store) {
    try {
        // Message parsing and validation
        const body = extractBody(m);
        const sender = m.key?.fromMe ? 
            (sock.user?.id?.split(':')[0] + '@s.whatsapp.net' || sock.user?.id) : 
            (m.key?.participant || m.key?.remoteJid || 'unknown@unknown');
        
        const senderNumber = String(sender).split('@')[0];
        const rawBody = typeof m.text === 'string' ? m.text : '';
        const prefix = '.';
        const from = m.key?.remoteJid || '';
        const isGroup = from.endsWith('@g.us');
        const botNumber = await sock.decodeJid?.(sock.user?.id) || '';
        const isCmd = body.startsWith(prefix);
        
        // Command parsing
        const parts = body.trim().split(' ').filter(Boolean);
        const command = isCmd ? (parts[0] || '').slice(prefix.length).toLowerCase() : '';
        const args = parts.slice(1);
        const pushname = m.pushName || 'No Name';
        const text = args.join(' ');

        // Group metadata extraction
        const groupMetadata = isGroup ? 
            await sock.groupMetadata?.(m.chat).catch(() => ({})) : {};
        const participants = (groupMetadata?.participants || []).map(p => ({
            id: p.id,
            jid: p.jid,
            admin: p.admin,
            raw: p
        }));
        
        const groupOwner = participants.find(p => p.admin === 'superadmin')?.jid || '';
        const groupAdmins = participants.filter(p => 
            ['admin', 'superadmin'].includes(p.admin)
        ).map(p => p.jid || p.id);
        
        const isBotAdmin = isGroup ? groupAdmins.includes(botNumber) : false;
        const isAdmin = isGroup ? groupAdmins.includes(m.sender) : false;
        const isGroupOwner = isGroup ? groupOwner === m.sender : false;

        // Command logging
        if (isCmd) {
            colorLog('COMMAND', `
╔══════════════════════════════════╗
║           COMMAND LOG            ║
╠══════════════════════════════════╣
║ Tanggal  : ${ANSI.cyan}${now()}${ANSI.reset}
║ Command  : ${ANSI.green}${command}${ANSI.reset}
║ Pengirim : ${ANSI.yellow}${pushname}${ANSI.reset}
║ JID      : ${ANSI.white}${senderNumber}${ANSI.reset}
╚══════════════════════════════════╝
            `.trim());
        }

        // Quick reply helper
        const reply = async txt => safeSend(sock, m.chat, txt, fquoted?.channel);

        // Command router
        switch (command) {
            // ------------------------------------------------------------------
            // BOT MENU COMMAND
            // ------------------------------------------------------------------
            case 'menu': {
                const title = `Hi ${pushname}! 👋`;
                await safeSend(sock, m.chat, {
                    interactiveMessage: {
                        title,
                        footer: config.settings.footer,
                        document: fs.existsSync('./package.json') ? 
                                fs.readFileSync('./package.json') : undefined,
                        mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        fileName: '@bot-menu',
                        jpegThumbnail: ASSETS.docu || undefined,
                        contextInfo: {
                            mentionedJid: [m.sender],
                            forwardingScore: 1,
                            isForwarded: false
                        },
                        externalAdReply: {
                            title: 'shenń Bot',
                            body: 'Professional WhatsApp Bot',
                            thumbnailUrl: config.thumbUrl,
                            sourceUrl: config.socialMedia?.Telegram || ''
                        }
                    }
                }, { quoted: m });
                break;
            }
            default:
                // Unknown command - silent ignore for clean operation
        }

    } catch (error) {
        colorLog('HANDLER_ERROR', `
╔══════════════════════════════════╗
║           ERROR REPORT           ║
╠══════════════════════════════════╣
║ Time: ${ANSI.red}${now()}${ANSI.reset}
║ Error: ${ANSI.red}${error.message}${ANSI.reset}
║ Stack: ${ANSI.yellow}${error.stack}${ANSI.reset}
╚══════════════════════════════════╝
        `.trim());
    }
}

// -----------------------------------------------------------------------------
// File Watcher for Development Hot Reload
// -----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);

/**
 * Watch for file changes and auto-reload
 */
fs.watchFile(__filename, () => {
    fs.unwatchFile(__filename);
    colorLog('RELOAD', `${__filename} updated! Hot reloading...`);
    process.exit(0);
});

colorLog('HANDLER', 'Message handler initialized successfully');