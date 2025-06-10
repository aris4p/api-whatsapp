const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const sessionRepo = require('../repositories/whatsappSessionRepo');
const inboxRepo = require('../repositories/inboxRepo');
const autoReply = require('../utils/autoReply');
const formatNumber = require('../utils/formatNumber');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

async function startSock(sessionId) {
    const { state, saveCreds } = await useMultiFileAuthState(`auth_info/auth_${sessionId}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({ version, auth: state });
    sessionRepo.add(sessionId, { sock, lastQr: null });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ connection, qr }) => {
        const session = sessionRepo.get(sessionId);
        if (qr) {
            session.lastQr = qr;
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') session.lastQr = null;
        if (connection === 'close') setTimeout(() => startSock(sessionId), 2000);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message) {
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const messageData = {
                from: msg.key.remoteJid,
                text,
                timestamp: msg.messageTimestamp,
                id: msg.key.id
            };
            inboxRepo.saveMessage(sessionId, messageData);

            const rules = autoReply.getAutoReplyRules();
            const reply = rules.find(r => text.toLowerCase().includes(r.keyword.toLowerCase()));
            if (reply) sock.sendMessage(msg.key.remoteJid, { text: reply.reply });
        }
    });
}

async function resetSession(sessionId) {
    const dir = `auth_info/auth_${sessionId}`;
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }

    const session = sessionRepo.get(sessionId);
    if (session?.sock?.logout) {
        try {
            await session.sock.logout();
        } catch (_) {}
    }

    sessionRepo.remove(sessionId);
}


module.exports = { startSock,resetSession };
