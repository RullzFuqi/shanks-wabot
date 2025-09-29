/**
 !========================!
 * Credit: KyuuRzy
 * Modifed By: RullzFuqi
 !========================!
  * Shanks - WhatsApp Bot
 */
import {
  makeWASocket as makeWASockets,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  jidDecode,
  downloadContentFromMessage
} from "@whiskeysockets/baileys";
import pino from "pino";
import { fileTypeFromBuffer, fileTypeFromFile } from "file-type";
import readline from "readline";
import fs from "fs";
import path from "path";
import { Boom } from "@hapi/boom";
import { getBuffer } from "./engine/engine.utils.js";
import { serializeMessage } from "./engine/engine.serialze.js";
import { videoToWebp, writeExifImg, writeExifVid, addExif } from "./library/exif.js";
import messageHandler from "./message.js";
import { fileURLToPath } from "url";

let statusTerm = true
class ANSI {
  static reset = "\x1b[0m";
  static bold = (s) => `\x1b[1m${s}${ANSI.reset}`;
  static yellow = (s) => `\x1b[33m${s}${ANSI.reset}`;
  static green = (s) => `\x1b[32m${s}${ANSI.reset}`;
  static cyan = (s) => `\x1b[36m${s}${ANSI.reset}`;
  static magenta = (s) => `\x1b[35m${s}${ANSI.reset}`;
  static blue = (s) => `\x1b[34m${s}${ANSI.reset}`;
}

class WhatsAppClient {
  constructor() {
    this.store = makeInMemoryStore({
      logger: pino().child({
        level: "silent",
        stream: "store"
      })
    });
    this.ignoredErrors = [
      "Socket connection timeout",
      "EKEYTYPE",
      "item-not-found",
      "rate-overlimit",
      "Connection Closed",
      "Timed Out",
      "Value not found"
    ];
  }

  question(text) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(ANSI.yellow(text), (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  async clientStart() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const sock = makeWASockets({
      logger: pino({ level: "silent" }),
      printQRInTerminal: !statusTerm,
      auth: state,
      browser: ["Ubuntu", "Chrome", "20.0.00"]
    });

    if (statusTerm && !sock.authState?.creds?.registered) {
      const phoneNumber = await this.question("enter your WhatsApp number, starting with 62:\nnumber WhatsApp: ");
      const code = await sock.requestPairingCode(phoneNumber, "SHANKSWB");
      console.log(ANSI.green("your pairing code: ") + ANSI.bold.green ? ANSI.bold(code) : code);
    }

    this.store.bind(sock.ev);
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (chatUpdate) => {
      try {
        const mek = chatUpdate.messages?.[0];
        if (!mek) return;
        mek.message = Object.keys(mek.message ?? {})[0] === "ephemeralMessage"
          ? mek.message.ephemeralMessage.message
          : mek.message;
          let statusRectSw = false
        if (statusRectSw && mek.key && mek.key.remoteJid === "status@broadcast") {
          const emoji = ["😘", "😭", "😂", "😹", "😍", "😋", "🙏", "😜", "😢", "😠", "🤫", "😎"];
          const sigma = emoji[Math.floor(Math.random() * emoji.length)];
          await sock.readMessages([mek.key]);
          await sock.sendMessage("status@broadcast", { react: { text: sigma, key: mek.key } }, { statusJidList: [mek.key.participant] });
        }
        if (!sock.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
        if (mek.key.id?.startsWith("SH3NN-") && mek.key.id.length === 12) return;
        const m = await serializeMessage(sock, mek, this.store);
        if (typeof messageHandler === "function") messageHandler(sock, m, chatUpdate, this.store);
        else if (messageHandler?.default) messageHandler.default(sock, m, chatUpdate, this.store);
      } catch (err) {
        console.log(err);
      }
    });

    sock.decodeJid = (jid) => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) || {};
        return decode.user && decode.server ? decode.user + "@" + decode.server : jid;
      } else return jid;
    };

    sock.ev.on("contacts.update", (update) => {
      for (const contact of update) {
        const id = sock.decodeJid(contact.id);
        if (this.store && this.store.contacts) this.store.contacts[id] = { id, name: contact.notify };
      }
    });

    sock.public = true;

    sock.ev.on("connection.update", (update) => {
      import("./library/connection/connection.js").then(({ konek }) => {
        if (typeof konek === "function") konek({ sock, update, clientstart: this.clientStart.bind(this), DisconnectReason, Boom });
        else if (konek?.default) konek.default({ sock, update, clientstart: this.clientStart.bind(this), DisconnectReason, Boom });
      }).catch(console.error);
    });

    sock.sendText = async (jid, text, quoted = "", options) => {
      await sock.sendMessage(jid, { text, ...options }, { quoted });
    };

    sock.downloadMediaMessage = async (message) => {
      const mime = (message.msg || message).mimetype || "";
      const messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
      const stream = await downloadContentFromMessage(message, messageType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      return buffer;
    };

    sock.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
      const buff = Buffer.isBuffer(path)
        ? path
        : /^data:.*?\/.*?;base64,/i.test(path)
        ? Buffer.from(path.split`, `[1], "base64")
        : /^https?:\/\//.test(path)
        ? await getBuffer(path)
        : fs.existsSync(path)
        ? fs.readFileSync(path)
        : Buffer.alloc(0);

      const buffer = (options && (options.packname || options.author))
        ? await writeExifImg(buff, options)
        : await addExif(buff);

      await sock.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
      return buffer;
    };

    sock.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
      const quoted = message.msg ? message.msg : message;
      const mime = (message.msg || message).mimetype || "";
      const messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
      const stream = await downloadContentFromMessage(quoted, messageType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      const type = await fileTypeFromBuffer(buffer);
      const trueFileName = attachExtension ? `${filename}.${type.ext}` : filename;
      await fs.promises.writeFile(trueFileName, buffer);
      return trueFileName;
    };

    sock.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
      const buff = Buffer.isBuffer(path)
        ? path
        : /^data:.*?\/.*?;base64,/i.test(path)
        ? Buffer.from(path.split`, `[1], "base64")
        : /^https?:\/\//.test(path)
        ? await getBuffer(path)
        : fs.existsSync(path)
        ? fs.readFileSync(path)
        : Buffer.alloc(0);

      const buffer = (options && (options.packname || options.author))
        ? await writeExifVid(buff, options)
        : await videoToWebp(buff);

      await sock.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted });
      return buffer;
    };

    sock.getFile = async (PATH, returnAsFilename) => {
      let res, filename;
      const data = Buffer.isBuffer(PATH)
        ? PATH
        : /^data:.*?\/.*?;base64,/i.test(PATH)
        ? Buffer.from(PATH.split`,`[1], "base64")
        : /^https?:\/\//.test(PATH)
        ? (res = await fetch(PATH)).buffer()
        : fs.existsSync(PATH)
        ? (filename = PATH, fs.readFileSync(PATH))
        : typeof PATH === "string"
        ? PATH
        : Buffer.alloc(0);

      if (!Buffer.isBuffer(data)) throw new TypeError("Result is not a buffer");
      const type = (await fileTypeFromBuffer(data)) || { mime: "application/octet-stream", ext: ".bin" };
      if (data && returnAsFilename && !filename) {
        filename = path.join(process.cwd(), "./tmp/" + Date.now() + "." + type.ext);
        await fs.promises.writeFile(filename, data);
      }
      return {
        res,
        filename,
        ...type,
        data,
        deleteFile() {
          return filename && fs.promises.unlink(filename);
        }
      };
    };

    sock.sendFile = async (jid, pathArg, filename = "", caption = "", quoted, ptt = false, options = {}) => {
      const type = await sock.getFile(pathArg, true);
      let { res, data: file, filename: pathFile } = type;
      if ((res && res.status !== 200) || file.length <= 65536) {
        try {
          throw { json: JSON.parse(file.toString()) };
        } catch (e) {
          if (e.json) throw e.json;
        }
      }
      const opt = { filename };
      if (quoted) opt.quoted = quoted;
      if (!type) options.asDocument = true;
      let mtype = "", mimetype = type.mime, convert;
      if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) mtype = "sticker";
      else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) mtype = "image";
      else if (/video/.test(type.mime)) mtype = "video";
      else if (/audio/.test(type.mime)) {
        convert = await (ptt ? this.toPTT(file, type.ext) : this.toAudio(file, type.ext));
        file = convert.data;
        pathFile = convert.filename;
        mtype = "audio";
        mimetype = "audio/ogg; codecs=opus";
      } else mtype = "document";
      if (options.asDocument) mtype = "document";
      const message = { ...options, caption, ptt, [mtype]: { url: pathFile }, mimetype };
      let m;
      try {
        m = await sock.sendMessage(jid, message, { ...opt, ...options });
      } catch (e) {
        console.error(e);
        m = null;
      } finally {
        if (!m) m = await sock.sendMessage(jid, { ...message, [mtype]: file }, { ...opt, ...options });
        return m;
      }
    };
  }

  async start() {
    try {
      await this.clientStart();
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }
}

process.on("uncaughtException", console.error);

const client = new WhatsAppClient();
client.start();

const file = fileURLToPath(import.meta.url);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  if (client.ignoredErrors.some((e) => String(reason).includes(e))) return;
  console.log("Unhandled Rejection:", reason);
});

const originalConsoleError = console.error;
console.error = function (msg, ...args) {
  if (typeof msg === "string" && client.ignoredErrors.some((e) => msg.includes(e))) return;
  originalConsoleError.apply(console, [msg, ...args]);
};

const originalStderrWrite = process.stderr.write;
process.stderr.write = function (msg, encoding, fd) {
  if (typeof msg === "string" && client.ignoredErrors.some((e) => msg.includes(e))) return;
  return originalStderrWrite.apply(process.stderr, arguments);
};