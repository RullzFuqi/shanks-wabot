// Requirements: Node.js >= 20, @whiskeysockets/baileys
/*
!---------- Shanks Wabot 🗡️ ---------- !
 - Credit RullzFuqi

 - Social RullzFuqi
   * Youtube https://www.youtube.com/@rullzaoshi
   * Tiktok https://www.tiktok.com/@rullzcode01
   * Website https://rullzfuqione.xyz
*/

import {
  makeWASocket as makeWASockets,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { makeInMemoryStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs/promises';
import readline from 'readline';
import { smsg } from './engine/myfunction.js';
import { handle } from './src/handler.js';

/* ---------- ANSI Logging Utilities ---------- */
const L = {
  info: (...s) => console.log('\x1b[36m[INFO]\x1b[0m', ...s),
  ok: (...s) => console.log('\x1b[32m[OK]\x1b[0m', ...s),
  warn: (...s) => console.log('\x1b[33m[WARN]\x1b[0m', ...s),
  err: (...s) => console.log('\x1b[31m[ERR]\x1b[0m', ...s),
  qr: (...s) => console.log('\x1b[33m[QR]\x1b[0m', ...s),
  ev: (...s) => console.log('\x1b[35m[EV]\x1b[0m', ...s),
};

/* ---------- BaileysBot Class ---------- */
class BaileysBot {
  constructor({ authDir = 'session', pairing = true } = {}) {
    this.authDir = authDir;
    this.usePairing = pairing;
    this.store = makeInMemoryStore({
      logger: pino().child({
        level: 'silent',
        stream: 'store',
      }),
    });
    this.logger = pino({ level: 'silent' });
    this._askedPair = false;
    this.jeki = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    process.on('SIGINT', () => {
      this.closeReadline();
      process.exit(0);
    });
  }

  /* ---------- Question Function ---------- */
  async question(text) {
    return new Promise((resolve) => {
      this.rl.question(text, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /* ---------- Cleanup Session  ---------- */
  async warnAndRemoveSession(msg) {
    L.warn(msg);
    await fs.rm(this.authDir, { recursive: true, force: true }).catch(() => {});
  }

  closeReadline() {
    if (this.rl) {
      this.rl.close();
    }
  }

  /* ---------- Handle Pairing Input ---------- */
  async handlePairing(jeki) {
    if (this._askedPair) return;

    this._askedPair = true;
    const yn = await this.question('Use pairing code instead of QR? [y/N]: ');

    if (yn.toLowerCase() === 'y' || yn.toLowerCase() === 'yes') {
      let raw = '';
      while (!raw) {
        raw = await this.question('Enter international number (without +): ');
        raw = raw.replace(/\D/g, '');

        if (!raw) {
          L.err('Number cannot be empty. Please try again.');
        } else if (raw.length < 8) {
          L.err('Number seems too short. Please enter a valid number.');
          raw = '';
        }
      }

      try {
        L.info('Requesting pairing code...');
        const pairingCode = await jeki.requestPairingCode(raw);
        L.ok('Pairing code:', pairingCode);
        L.info(
          'Follow: WhatsApp -> Settings -> Linked devices -> Link a device -> Enter pairing code.'
        );
      } catch (e) {
        L.warn('Pairing code request failed:', e.message);
        L.warn('Falling back to QR code authentication.');
      }
    } else {
      L.info('Using QR code for authentication.');
    }
  }

  /* ---------- Initialize And Start ---------- */
  async start() {
    try {
      const { version, isLatest } = await fetchLatestBaileysVersion();
      L.info('Baileys protocol', version.join('.'), isLatest ? '(latest)' : '(not-latest)');

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.jeki = makeWASockets({
        auth: state,
        logger: this.logger,
        version,
        printQRInTerminal: false,
      });

      /* ---------- Event Store And Creds ---------- */
      this.store.bind(this.jeki.ev);
      this.jeki.ev.on('creds.update', saveCreds);

      /* ---------- Event Handler Message ---------- */
this.jeki.ev.on('messages.upsert', async ({ messages, type }) => {
  // Only process messages with notify type (new messages)
  if (type !== 'notify') return;

  for (let message of messages) {
    try {
      if (!message?.message) continue;

      // Skip newsletter/broadcast messages
      if (message.key?.remoteJid?.endsWith('@broadcast') || 
          message.key?.remoteJid?.endsWith('@newsletter')) continue;

      // Skip certain message IDs (like status messages)
      if (message.key?.id?.startsWith('BAE5') && message.key.id.length === 16) continue;

      // Handle ephemeral messages
      message.message =
        Object.keys(message.message)[0] === 'ephemeralMessage'
          ? message.message.ephemeralMessage.message
          : message.message;

      const m = smsg(this.jeki, message, this.store);
      
      // Skip messages from bots
      if (m.isBot) continue;
      
      // Process the message through handler
      if (typeof handle === 'function') {
        await handle(this.jeki, m, this.store);
      }
    } catch (error) {
      L.err('Error processing message:', error.message);
    }
  }
});

      /* ---------- Event Contacts ---------- */
      this.jeki.ev.on('contacts.upsert', (c) => {
        L.ev('Contacts updated', c.length);
      });

      this.jeki.ev.on('chats.set', (c) => {
        L.ev('Chats set', Array.isArray(c) ? c.length : 'set');
      });

      /* ---------- Manually QR Handling ---------- */
      this.jeki.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !this._askedPair) {
          L.qr('QR code available. Scan when ready.');
          L.qr('If you prefer pairing, answer the question above.');
        }

        if (connection === 'open') {
          const id = this.jeki.user?.id?.split(':')[0] ?? 'unknown';
          L.ok(`${id} connected successfully`);
          this.closeReadline();
          return;
        }

        if (connection === 'close') {
          const statusCode =
            lastDisconnect?.error?.output?.statusCode ||
            lastDisconnect?.error?.output?.payload?.statusCode ||
            lastDisconnect?.error?.statusCode;

          const reason = lastDisconnect?.error?.message ?? 'unknown';
          L.err('Disconnected:', reason, `(${statusCode || 'N/A'})`);

          /* ---------- Handle Disconnect Reason ---------- */
          switch (statusCode) {
            case DisconnectReason.BadSession:
              await this.warnAndRemoveSession('Invalid session. Removing session folder.');
              break;
            case DisconnectReason.ConnectionClosed:
            case DisconnectReason.TimedOut:
            case DisconnectReason.RestartRequired:
              L.warn('Attempting automatic reconnect...');
              break;
            default:
              L.warn('Unknown disconnect reason. Restarting...');
          }

          setTimeout(() => this.start(), 1500);
          return;
        }

        if (
          connection === 'connecting' &&
          !this.jeki.authState?.creds?.registered &&
          this.usePairing &&
          !this._askedPair
        ) {
          await this.handlePairing(this.jeki);
        }
      });

      return this.jeki;
    } catch (error) {
      L.err('Startup error:', error.message);
      this.closeReadline();
      throw error;
    }
  }
}

/* ---------- Application Entry Point ---------- */
(async () => {
  try {
    const bot = new BaileysBot({ authDir: 'session', pairing: true });
    await bot.start();
  } catch (error) {
    L.err('Fatal error:', error.message);
    process.exit(1);
  }
})();
