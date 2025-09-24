import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import Crypto from 'crypto'
import ff from 'fluent-ffmpeg'
import webp from 'node-webpmux'

function ffmpeg(buffer, args = [], ext = '', ext2 = '') {
    return new Promise(async (resolve, reject) => {
        try {
            const tmpPath = path.join(tmpdir(), `${Date.now()}.${ext}`)
            const outPath = `${tmpPath}.${ext2}`
            
            await fs.promises.writeFile(tmpPath, buffer)
            
            spawn('ffmpeg', ['-y', '-i', tmpPath, ...args, outPath])
                .on('error', reject)
                .on('close', async (code) => {
                    try {
                        await fs.promises.unlink(tmpPath)
                        if (code !== 0) return reject(code)
                        
                        const result = await fs.promises.readFile(outPath)
                        await fs.promises.unlink(outPath)
                        resolve(result)
                    } catch (error) {
                        reject(error)
                    }
                })
        } catch (error) {
            reject(error)
        }
    })
}

export function toAudio(buffer, ext) {
    return ffmpeg(buffer, [
        '-vn', '-ac', '2', '-b:a', '128k', '-ar', '44100', '-f', 'mp3'
    ], ext, 'mp3')
}

export function toPTT(buffer, ext) {
    return ffmpeg(buffer, [
        '-vn', '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', '-compression_level', '10'
    ], ext, 'opus')
}

export function toVideo(buffer, ext) {
    return ffmpeg(buffer, [
        '-c:v', 'libx264', '-c:a', 'aac', '-ab', '128k', '-ar', '44100', '-crf', '32', '-preset', 'slow'
    ], ext, 'mp4')
}

async function imageToWebp(media) {
    const tmpOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`)
    
    fs.writeFileSync(tmpIn, media)
    
    await new Promise((resolve, reject) => {
        ff(tmpIn)
            .on('error', reject)
            .on('end', () => resolve(true))
            .addOutputOptions([
                '-vcodec', 'libwebp',
                '-vf', "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse"
            ])
            .toFormat('webp')
            .save(tmpOut)
    })

    const buffer = fs.readFileSync(tmpOut)
    fs.unlinkSync(tmpOut)
    fs.unlinkSync(tmpIn)
    return buffer
}

async function videoToWebp(media) {
    const tmpOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.mp4`)
    
    fs.writeFileSync(tmpIn, media)
    
    await new Promise((resolve, reject) => {
        ff(tmpIn)
            .on('error', reject)
            .on('end', () => resolve(true))
            .addOutputOptions([
                '-vcodec', 'libwebp',
                '-vf', "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
                '-loop', '0', '-ss', '00:00:00', '-t', '00:00:05',
                '-preset', 'default', '-an', '-vsync', '0'
            ])
            .toFormat('webp')
            .save(tmpOut)
    })

    const buffer = fs.readFileSync(tmpOut)
    fs.unlinkSync(tmpOut)
    fs.unlinkSync(tmpIn)
    return buffer
}

async function writeExifImg(media, metadata) {
    const webpBuffer = await imageToWebp(media)
    const tmpIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    
    fs.writeFileSync(tmpIn, webpBuffer)

    if (metadata.packname || metadata.author) {
        const img = new webp.Image()
        const json = {
            'sticker-pack-id': 'https://github.com/KyuuRzy',
            'sticker-pack-name': metadata.packname,
            'sticker-pack-publisher': metadata.author,
            'emojis': metadata.categories ? metadata.categories : ['']
        }
        
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
        const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8')
        const exif = Buffer.concat([exifAttr, jsonBuff])
        exif.writeUIntLE(jsonBuff.length, 14, 4)
        
        await img.load(tmpIn)
        fs.unlinkSync(tmpIn)
        img.exif = exif
        await img.save(tmpOut)
        
        return fs.readFileSync(tmpOut)
    }
}

async function writeExifVid(media, metadata) {
    const webpBuffer = await videoToWebp(media)
    const tmpIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    
    fs.writeFileSync(tmpIn, webpBuffer)

    if (metadata.packname || metadata.author) {
        const img = new webp.Image()
        const json = {
            'sticker-pack-id': 'https://github.com/KyuuRzy',
            'sticker-pack-name': metadata.packname,
            'sticker-pack-publisher': metadata.author,
            'emojis': metadata.categories ? metadata.categories : ['']
        }
        
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
        const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8')
        const exif = Buffer.concat([exifAttr, jsonBuff])
        exif.writeUIntLE(jsonBuff.length, 14, 4)
        
        await img.load(tmpIn)
        fs.unlinkSync(tmpIn)
        img.exif = exif
        await img.save(tmpOut)
        
        return fs.readFileSync(tmpOut)
    }
}

async function writeExif(media, metadata) {
    let webpBuffer
    if (/webp/.test(media.mimetype)) {
        webpBuffer = media.data
    } else if (/image/.test(media.mimetype)) {
        webpBuffer = await imageToWebp(media.data)
    } else if (/video/.test(media.mimetype)) {
        webpBuffer = await videoToWebp(media.data)
    } else {
        throw new Error('Unsupported media type')
    }

    const tmpIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    
    fs.writeFileSync(tmpIn, webpBuffer)

    if (metadata.packname || metadata.author) {
        const img = new webp.Image()
        const json = {
            'sticker-pack-id': 'https://github.com/KyuuRzy',
            'sticker-pack-name': metadata.packname,
            'sticker-pack-publisher': metadata.author,
            'emojis': metadata.categories ? metadata.categories : ['']
        }
        
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
        const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8')
        const exif = Buffer.concat([exifAttr, jsonBuff])
        exif.writeUIntLE(jsonBuff.length, 14, 4)
        
        await img.load(tmpIn)
        fs.unlinkSync(tmpIn)
        img.exif = exif
        await img.save(tmpOut)
        
        return fs.readFileSync(tmpOut)
    }
}

async function exifAvatar(buffer, packname, author, categories = [''], extra = {}) {
    const { Image } = webp
    const img = new Image()
    const json = {
        'sticker-pack-id': 'kyuuryz-bot',
        'sticker-pack-name': packname,
        'sticker-pack-publisher': author,
        'emojis': categories,
        'is-avatar-sticker': 1,
        ...extra
    }
    
    const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
    const exif = Buffer.concat([exifAttr, jsonBuffer])
    exif.writeUIntLE(jsonBuffer.length, 14, 4)
    
    await img.load(buffer)
    img.exif = exif
    return await img.save(null)
}

async function addExif(webpSticker, packname, author, categories = [''], extra = {}) {
    const img = new webp.Image()
    const stickerPackId = Crypto.randomBytes(32).toString('hex')
    const json = {
        'sticker-pack-id': stickerPackId,
        'sticker-pack-name': packname,
        'sticker-pack-publisher': author,
        'emojis': categories,
        ...extra
    }
    
    const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
    const exif = Buffer.concat([exifAttr, jsonBuffer])
    exif.writeUIntLE(jsonBuffer.length, 14, 4)
    
    await img.load(webpSticker)
    img.exif = exif
    return await img.save(null)
}

export { 
    imageToWebp,
    videoToWebp, 
    writeExifImg, 
    writeExifVid, 
    writeExif, 
    exifAvatar, 
    addExif 
}