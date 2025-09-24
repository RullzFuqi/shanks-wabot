/**
 !========================!
 * Credit: KyuuRzy
 * Modifed By: RullzFuqi
 !========================!
  * Shanks - WhatsApp Bot
 */
 
import { jidNormalizedUser, proto, getContentType, areJidsSameUser } from "@whiskeysockets/baileys";

class MessageSerializer {
    constructor(sock, store) {
        this.sock = sock;
        this.store = store;
        this.MessageProto = proto.WebMessageInfo;
    }

    async process(message) {
        if (!message) return message;

        const m = { ...message };
        
        this._processKeyProperties(m);
        this._processMessageContent(m);
        this._processQuotedMessage(m);
        this._processMessageText(m);
        this._attachUtilityMethods(m);

        return m;
    }

    _processKeyProperties(m) {
        if (!m.key) return;

        m.id = m.key.id;
        m.from = m.key.remoteJid.startsWith('status') 
            ? jidNormalizedUser(m.key?.participant || m.participant) 
            : jidNormalizedUser(m.key.remoteJid);
        
        m.isBaileys = m.id?.startsWith('BAE5') && m.id.length === 16;
        m.chat = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.isGroup = m.chat.endsWith('@g.us');
        m.sender = this.sock.decodeJid(
            m.fromMe && this.sock.user.id || 
            m.participant || 
            m.key.participant || 
            m.chat || ''
        );
        
        if (m.isGroup) {
            m.participant = this.sock.decodeJid(m.key.participant) || '';
        }
    }

    _processMessageContent(m) {
        if (!m.message) return;

        m.mtype = getContentType(m.message);
        m.msg = this._extractMessageContent(m);
        m.body = this._extractMessageBody(m);
    }

    _extractMessageContent(m) {
        if (m.mtype === 'viewOnceMessage') {
            const innerMessage = m.message[m.mtype].message;
            return innerMessage[getContentType(innerMessage)];
        }
        return m.message[m.mtype];
    }

    _extractMessageBody(m) {
        return m.message.conversation || 
               m.msg.caption || 
               m.msg.text || 
               (m.mtype === 'listResponseMessage' && m.msg.singleSelectReply?.selectedRowId) ||
               (m.mtype === 'buttonsResponseMessage' && m.msg.selectedButtonId) ||
               (m.mtype === 'viewOnceMessage' && m.msg.caption) || 
               m.text || '';
    }

    _processQuotedMessage(m) {
        if (!m.msg?.contextInfo?.quotedMessage) return;

        const quoted = m.quoted = m.msg.contextInfo.quotedMessage;
        m.mentionedJid = m.msg.contextInfo?.mentionedJid || [];

        this._normalizeQuotedMessage(m, quoted);
        this._buildQuotedMessageObject(m);
        this._attachQuotedUtilities(m);
    }

    _normalizeQuotedMessage(m, quoted) {
        let type = getContentType(quoted);
        m.quoted = quoted[type];

        if (['productMessage'].includes(type)) {
            type = getContentType(m.quoted);
            m.quoted = m.quoted[type];
        }

        if (typeof m.quoted === 'string') {
            m.quoted = { text: m.quoted };
        }
    }

    _buildQuotedMessageObject(m) {
        m.quoted.key = {
            remoteJid: m.msg?.contextInfo?.remoteJid || m.from,
            participant: jidNormalizedUser(m.msg?.contextInfo?.participant),
            fromMe: areJidsSameUser(
                jidNormalizedUser(m.msg?.contextInfo?.participant),
                jidNormalizedUser(this.sock?.user?.id)
            ),
            id: m.msg?.contextInfo?.stanzaId,
        };

        m.quoted.mtype = getContentType(m.msg.contextInfo.quotedMessage);
        m.quoted.from = /g\.us|status/.test(m.msg?.contextInfo?.remoteJid) 
            ? m.quoted.key.participant 
            : m.quoted.key.remoteJid;
        
        m.quoted.id = m.msg.contextInfo.stanzaId;
        m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat;
        m.quoted.isBaileys = m.quoted.id?.startsWith('BAE5') && m.quoted.id.length === 16;
        m.quoted.sender = this.sock.decodeJid(m.msg.contextInfo.participant);
        m.quoted.fromMe = m.quoted.sender === (this.sock.user?.id);
        m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || 
                       m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || '';
        m.quoted.mentionedJid = m.msg.contextInfo?.mentionedJid || [];
    }

    _attachQuotedUtilities(m) {
        m.getQuotedObj = m.getQuotedMessage = async () => {
            if (!m.quoted.id) return null;
            const quotedMessage = await this.store.loadMessage(m.chat, m.quoted.id, this.sock);
            return new MessageSerializer(this.sock, this.store).process(quotedMessage);
        };

        const quotedProto = this.MessageProto.fromObject({
            key: {
                remoteJid: m.quoted.chat,
                fromMe: m.quoted.fromMe,
                id: m.quoted.id
            },
            message: m.msg.contextInfo.quotedMessage,
            ...(m.isGroup ? { participant: m.quoted.sender } : {})
        });

        m.quoted.fakeObj = quotedProto;
        m.quoted.delete = () => this.sock.sendMessage(m.quoted.chat, { delete: quotedProto.key });
        m.quoted.copyNForward = (jid, forceForward = false, options = {}) => 
            this.sock.copyNForward(jid, quotedProto, forceForward, options);
        m.quoted.download = () => this.sock.downloadMediaMessage(m.quoted);
    }

    _processMessageText(m) {
        m.text = m.msg?.text || m.msg?.caption || m.message?.conversation || 
                m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || '';
    }

    _attachUtilityMethods(m) {
        if (m.msg?.url) {
            m.download = () => this.sock.downloadMediaMessage(m.msg);
        }

        m.reply = (content, chatId = m.chat, options = {}) => 
            Buffer.isBuffer(content) 
                ? this.sock.sendMedia(chatId, content, 'file', '', m, options)
                : this.sock.sendText(chatId, content, m, options);

        m.copy = () => new MessageSerializer(this.sock, this.store)
            .process(this.MessageProto.fromObject(this.MessageProto.toObject(m)));

        m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => 
            this.sock.copyNForward(jid, m, forceForward, options);

        m.forward = (jid, options = {}) => this.sock.sendMessage(jid, { forward: m }, options);
        m.react = (emoji) => this.sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } });
        m.delete = () => this.sock.sendMessage(m.chat, { delete: m.key });
    }
}

const createSerializer = (sock, store) => new MessageSerializer(sock, store);
const serializeMessage = async (sock, m, store) => createSerializer(sock, store).process(m);

export { MessageSerializer, createSerializer, serializeMessage };
export default serializeMessage;