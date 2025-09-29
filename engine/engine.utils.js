// utils-esm.js
// ESM, named exports only.
// Dependencies: only Node built-ins + @whiskeysockets/baileys (yang kamu pakai).
// Tujuan: utility lengkap untuk bot (network, file, media, cache, rate-limit).
// Desain: modular, testable, dependency-injectable, sedikit asumsi pada environment (globalThis.fetch jika tersedia).

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import stream from 'stream';
import { promisify } from 'util';
import http from 'http';
import https from 'https';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const pipeline = promisify(stream.pipeline);

/* ===========================
   Basic async helpers
   =========================== */

/** Pause async execution for ms milliseconds */
export const sleep = (ms = 0) => new Promise((res) => setTimeout(res, ms));

/** For Ram Usage Ping */
export const fmt = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;

/** Generate random hex id, length = bytes */
export const randomId = (bytes = 8) => crypto.randomBytes(bytes).toString('hex');

/* ===========================
   Small text helpers
   =========================== */

/** Test if string includes URL */
export const isUrl = (text = '') => /\bhttps?:\/\/[^\s/$.?#].[^\s]*\b/i.test(String(text));

/** Extract all URLs */
export const extractUrls = (text = '') =>
  String(text).match(/\bhttps?:\/\/[^\s/$.?#].[^\s]*\b/gi) || [];

/** Parse `.cmd arg1 arg2` into {command, args}. Null if no prefix */
export function parseCommand(body = '', prefix = '.') {
  if (typeof body !== 'string') return null;
  const s = body.trim();
  if (!s.startsWith(prefix)) return null;
  const parts = s.slice(prefix.length).trim().split(/\s+/);
  const command = parts.shift()?.toLowerCase() || '';
  return { command, args: parts };
}

/* ===========================
   Network: fetch / getBuffer / fetchJson
   (uses global fetch if available; fallback to http/https)
   =========================== */

/** Internal helper: http/https GET buffer */
async function _httpGetBuffer(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: options.timeout || 15000 }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 400) return reject(new Error(`GET ${url} failed ${status}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Get Buffer from URL or local file path.
 * - accepts http/https URL or filesystem path.
 * - uses global fetch when available (Node 18+ / polyfill), else fallback to native http/https.
 */
export async function getBuffer(source, opts = {}) {
  if (typeof source !== 'string') throw new TypeError('getBuffer: source must be string');
  // data URI
  if (source.startsWith('data:')) {
    const [, rest] = source.split(',');
    return Buffer.from(rest, source.includes(';base64') ? 'base64' : 'utf8');
  }
  // url
  if (/^https?:\/\//i.test(source)) {
    if (typeof globalThis.fetch === 'function') {
      const res = await globalThis.fetch(source, { timeout: opts.timeout });
      if (!res.ok) throw new Error(`fetch ${source} failed ${res.status}`);
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
    // fallback
    return _httpGetBuffer(source, opts);
  }
  // local file
  return fs.readFile(path.resolve(source));
}

/**
 * Fetch JSON from URL (uses getBuffer then JSON.parse).
 * - Throws if non-JSON or non-2xx (best-effort).
 */
export async function fetchJson(url, opts = {}) {
  if (typeof url !== 'string') throw new TypeError('fetchJson: url must be string');
  // if global fetch exists prefer it to get headers/status
  if (typeof globalThis.fetch === 'function') {
    const res = await globalThis.fetch(url, opts);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const e = new Error(`fetchJson failed ${res.status}`);
      e.status = res.status;
      e.body = txt;
      throw e;
    }
    return res.json();
  }
  // fallback
  const buf = await getBuffer(url, opts);
  return JSON.parse(buf.toString('utf8'));
}

/* ===========================
   Simple file type detection from buffer (no external lib)
   Checks common magic numbers only. Returns { mime, ext }.
   =========================== */

export function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer || []);
  const b0 = buffer.slice(0, 12);

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b0.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }

  // JPG: FF D8 FF
  if (b0.slice(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // GIF: 47 49 46 38
  if (b0.slice(0, 4).equals(Buffer.from([0x47, 0x49, 0x46, 0x38]))) {
    return { mime: 'image/gif', ext: 'gif' };
  }

  // WEBP: 'RIFF' .... 'WEBP'
  if (b0.slice(0, 4).toString() === 'RIFF' && b0.slice(8, 12).toString() === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }

  // MP4 / M4A / 3GP: contains 'ftyp' at position 4
  if (b0.slice(4, 8).toString() === 'ftyp') {
    // some further heuristics
    const brand = b0.slice(8, 12).toString();
    if (brand.includes('mp41') || brand.includes('isom') || brand.includes('mp42')) {
      return { mime: 'video/mp4', ext: 'mp4' };
    }
    return { mime: 'video/mp4', ext: 'mp4' };
  }

  // MKV: 1A 45 DF A3
  if (b0.slice(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mime: 'video/x-matroska', ext: 'mkv' };
  }

  // MP3: ID3 or frame 0xFF 0xFB
  if (b0.slice(0, 3).toString() === 'ID3' || b0.slice(0, 2).equals(Buffer.from([0xff, 0xfb]))) {
    return { mime: 'audio/mpeg', ext: 'mp3' };
  }

  // OGG: 'OggS'
  if (b0.slice(0, 4).toString() === 'OggS') {
    return { mime: 'audio/ogg', ext: 'ogg' };
  }

  // PDF
  if (b0.slice(0, 4).toString() === '%PDF') {
    return { mime: 'application/pdf', ext: 'pdf' };
  }

  // ZIP / APK / JAR: PK..
  if (b0.slice(0, 2).equals(Buffer.from([0x50, 0x4b]))) {
    return { mime: 'application/zip', ext: 'zip' };
  }

  // fallback
  return { mime: 'application/octet-stream', ext: 'bin' };
}

/* ===========================
   File cache helper (stateful)
   =========================== */

export class FileCache {
  /**
   * @param {Object} opts
   * @param {string} opts.dir directory to store files
   * @param {number} opts.maxEntries max files to keep
   */
  constructor({ dir = path.join(os.tmpdir(), 'bot-cache'), maxEntries = 128 } = {}) {
    this.dir = dir;
    this.maxEntries = Math.max(1, maxEntries);
    this._initPromise = fs.mkdir(this.dir, { recursive: true }).catch(() => {});
  }

  async store(buffer, name = randomId(6)) {
    await this._initPromise;
    const filepath = path.join(this.dir, `${name}_${Date.now()}`);
    await fs.writeFile(filepath, buffer);
    await this._cleanup();
    return filepath;
  }

  async read(filepath) {
    try {
      return await fs.readFile(filepath);
    } catch {
      return null;
    }
  }

  async _cleanup() {
    const files = await fs.readdir(this.dir).catch(() => []);
    if (files.length <= this.maxEntries) return;
    const metas = await Promise.all(
      files.map(async (f) => {
        const stat = await fs.stat(path.join(this.dir, f)).catch(() => null);
        return stat ? { f, mtime: stat.mtimeMs } : null;
      })
    );
    const valid = metas.filter(Boolean).sort((a, b) => a.mtime - b.mtime);
    const remove = valid.slice(0, Math.max(0, valid.length - this.maxEntries));
    await Promise.all(remove.map((r) => fs.unlink(path.join(this.dir, r.f)).catch(() => {})));
  }
}

/* ===========================
   Rate limiter - token bucket
   =========================== */

export class RateLimiter {
  constructor({ capacity = 5, refillRate = 1 } = {}) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.last = Date.now();
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
  }

  async removeTokens(count = 1) {
    if (count > this.capacity) throw new Error('Requested tokens exceed capacity');
    while (true) {
      this._refill();
      if (this.tokens >= count) {
        this.tokens -= count;
        return;
      }
      const waitMs = Math.ceil(((count - this.tokens) / this.refillRate) * 1000);
      await sleep(Math.min(waitMs, 5000));
    }
  }
}

/* ===========================
   Save stream or buffer to file safely (large files)
   =========================== */

export async function streamToFile(bufferOrStream, outPath) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  if (Buffer.isBuffer(bufferOrStream)) {
    await fs.writeFile(outPath, bufferOrStream);
    return outPath;
  }
  const writable = createWriteStream(outPath);
  await pipeline(bufferOrStream, writable);
  return outPath;
}

/* ===========================
   Baileys media downloader (no external file-type lib)
   - Exposes downloadMessageBuffer(sock, message)
   - Exposes saveMessageToFile(sock, message, outDir)
   =========================== */

export class BaileysMediaDownloader {
  /**
   * Download media from a Baileys message object.
   * Returns { buffer, mime, ext }.
   * Note: uses downloadContentFromMessage from baileys.
   */
  static async downloadMessageBuffer(sock, m) {
    if (!m || typeof m !== 'object' || !m.message) throw new TypeError('Invalid Baileys message');
    // find first candidate media key
    const msg = m.message;
    const mediaKeys = [
      'imageMessage',
      'videoMessage',
      'audioMessage',
      'stickerMessage',
      'documentMessage',
      'contactMessage',
      'locationMessage',
      'productMessage',
      'extendedTextMessage',
      'viewOnceMessage',
    ];
    const key = Object.keys(msg).find((k) => mediaKeys.includes(k));
    if (!key) {
      // fallback: choose first non-conversation key
      const alt = Object.keys(msg).find((k) => k !== 'conversation');
      if (!alt) throw new Error('No media field found');
      // use alt
      const node = msg[alt];
      // attempt download if has url or mimetype
      const mime = (node && (node.mimetype || node.mediaType)) || 'application/octet-stream';
      // try download via baileys helper with type guessed
      const type = mime.split('/')[0];
      const streamIter = await downloadContentFromMessage(node, type);
      const chunks = [];
      for await (const c of streamIter) chunks.push(c);
      const b = Buffer.concat(chunks);
      const det = detectFileType(b);
      return { buffer: b, mime: det.mime ?? mime, ext: det.ext };
    }

    const mediaNode = msg[key];
    const mime = mediaNode?.mimetype || mediaNode?.mediaType || 'application/octet-stream';
    const type = mime.split('/')[0] || (key.includes('image') ? 'image' : 'document');
    // downloadContentFromMessage returns async iterable of Buffer chunks
    const streamIter = await downloadContentFromMessage(mediaNode, type);
    const chunks = [];
    for await (const chunk of streamIter) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const det = detectFileType(buffer);
    return { buffer, mime: det.mime || mime, ext: det.ext };
  }

  /** Save message media to file, returns filepath */
  static async saveMessageToFile(sock, m, outDir = path.join(os.tmpdir(), 'wa-media')) {
    const { buffer, ext } = await BaileysMediaDownloader.downloadMessageBuffer(sock, m);
    await fs.mkdir(outDir, { recursive: true });
    const file = path.join(outDir, `${randomId(6)}.${ext}`);
    await fs.writeFile(file, buffer);
    return file;
  }
}

/* ===========================
   Retry wrapper
   =========================== */

export async function retry(fn, { attempts = 3, delay = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(delay * (i + 1));
    }
  }
  throw lastErr;
}

/* ===========================
   Convenience exports
   =========================== */

export const Utils = {
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
};

/* ===========================
   Short design notes:
   - No external binary libs used. Minimal magic detection for common formats.
   - getBuffer uses global fetch when available for modern Node versions.
   - BaileysMediaDownloader isolates library-specific streaming.
   - FileCache is local FS-based; swap to Redis for production scale.
   - RateLimiter is token-bucket for per-worker throttling.
   =========================== */
