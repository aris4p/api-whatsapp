const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Tangani error JSON
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ status: false, message: 'Invalid JSON format!' });
    }
    next(err);
});

let sessions = {}; // Multi-session store

// Reset satu session
async function resetSession(sessionId) {
    const dir = `auth_info_baileys_${sessionId}`;
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    if (sessions[sessionId] && sessions[sessionId].sock && sessions[sessionId].sock.logout) {
        try {
            await sessions[sessionId].sock.logout();
        } catch (e) {}
    }
    delete sessions[sessionId];
}

// Auto reply per sesi (bisa dikembangkan ke per sesi, sekarang global dulu)
function getAutoReplyRules() {
    if (fs.existsSync('autoreply.json')) {
        return JSON.parse(fs.readFileSync('autoreply.json'));
    }
    return [];
}
function saveAutoReplyRules(rules) {
    fs.writeFileSync('autoreply.json', JSON.stringify(rules, null, 2));
}

function formatNumber(number) {
    return number.includes('@s.whatsapp.net') ? number : number.replace(/\D/g,'') + '@s.whatsapp.net';
}

// Mulai WA session baru
async function startSock(sessionId) {
    const { state, saveCreds } = await useMultiFileAuthState(`auth_info_baileys_${sessionId}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state
    });

    sessions[sessionId] = { sock, lastQr: null };

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) {
            sessions[sessionId].lastQr = qr;
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') {
            sessions[sessionId].lastQr = null;
            console.log('WhatsApp connection established for session:', sessionId);
        }
        if (connection === 'close') {
            setTimeout(() => startSock(sessionId), 2000);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (!m.messages) return;
        const msg = m.messages[0];
        if (msg.key.fromMe || !msg.message) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const from = msg.key.remoteJid;
        const timestamp = msg.messageTimestamp;

        // Save inbox per sesi
        let inbox = [];
        const inboxFile = `inbox_${sessionId}.json`;
        if (fs.existsSync(inboxFile)) {
            inbox = JSON.parse(fs.readFileSync(inboxFile));
        }
        inbox.push({ from, text, timestamp, id: msg.key.id });
        fs.writeFileSync(inboxFile, JSON.stringify(inbox, null, 2));

        // Auto-reply (masih global, bisa dibuat per sesi juga)
        const rules = getAutoReplyRules();
        const lowerText = text.toLowerCase();
        for (const rule of rules) {
            if (lowerText.includes(rule.keyword.toLowerCase())) {
                await sock.sendMessage(from, { text: rule.reply });
                break;
            }
        }
    });
}

// ----------- ENDPOINTS -----------

// Mulai session baru
app.post('/start-session', asyncHandler(async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ status: false, message: 'sessionId is required!' });
    if (sessions[sessionId]) return res.status(400).json({ status: false, message: 'Session already exists!' });
    await startSock(sessionId);
    res.json({ status: true, message: `Session ${sessionId} started!` });
}));

// Reset session
app.post('/reset-session', asyncHandler(async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ status: false, message: 'sessionId is required!' });
    if (!sessions[sessionId]) return res.status(400).json({ status: false, message: 'Session does not exist!' });
    await resetSession(sessionId);
    await startSock(sessionId);
    res.json({ status: true, message: `Session ${sessionId} reset! Silakan scan ulang QR.` });
}));

// Cek status sesi
app.get('/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (!session) return res.json({ status: false, message: 'Session does not exist!' });
    res.json({
        status: session.sock?.user ? 'connected' : 'disconnected',
        user: session.sock?.user || null
    });
});

// Ambil QR string (manual scan)
app.get('/qr/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (!session || !session.lastQr) {
        return res.json({ status: false, message: 'QR code tidak tersedia atau sudah login.' });
    }
    res.json({ status: true, qr: session.lastQr });
});

// Ambil QR PNG base64
app.get('/qr-image/:sessionId', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (!session || !session.lastQr) {
        return res.json({ status: false, message: 'QR code tidak tersedia atau sudah login.' });
    }
    const qrPng = await QRCode.toDataURL(session.lastQr);
    res.json({ status: true, qr: session.lastQr, qr_image: qrPng });
}));

// Update auto-reply rules (masih global, bisa dipisah per sesi jika perlu)
app.post('/auto-reply', (req, res) => {
    const rules = req.body.rules;
    if (!Array.isArray(rules)) {
        return res.status(400).json({ status: false, message: 'rules should be an array!' });
    }
    saveAutoReplyRules(rules);
    res.json({ status: true, message: 'Auto-reply rules updated.', rules });
});

app.get('/auto-reply', (req, res) => {
    const rules = getAutoReplyRules();
    res.json({ status: true, rules });
});

// Kirim pesan teks
app.post('/send-message', asyncHandler(async (req, res) => {
    const { sessionId, number, message } = req.body;
    if (!sessionId || !number || !message) {
        return res.status(400).json({ status: false, message: 'sessionId, number & message is required!' });
    }
    const session = sessions[sessionId];
    if (!session) return res.status(400).json({ status: false, message: 'Session does not exist!' });
    await session.sock.sendMessage(formatNumber(number), { text: message });
    res.json({ status: true, message: 'Message sent!' });
}));

// Kirim gambar
app.post('/send-image', upload.single('image'), asyncHandler(async (req, res) => {
    const { sessionId, number, caption } = req.body;
    if (!sessionId || !number || !req.file) {
        return res.status(400).json({ status: false, message: 'sessionId, number & image is required!' });
    }
    const session = sessions[sessionId];
    if (!session) return res.status(400).json({ status: false, message: 'Session does not exist!' });
    const media = fs.readFileSync(req.file.path);
    await session.sock.sendMessage(formatNumber(number), {
        image: media,
        caption: caption || ''
    });
    fs.unlinkSync(req.file.path);
    res.json({ status: true, message: 'Image sent!' });
}));

// Kirim file
app.post('/send-file', upload.single('file'), asyncHandler(async (req, res) => {
    const { sessionId, number, caption } = req.body;
    if (!sessionId || !number || !req.file) {
        return res.status(400).json({ status: false, message: 'sessionId, number & file is required!' });
    }
    const session = sessions[sessionId];
    if (!session) return res.status(400).json({ status: false, message: 'Session does not exist!' });
    const media = fs.readFileSync(req.file.path);
    await session.sock.sendMessage(formatNumber(number), {
        document: media,
        mimetype: req.file.mimetype,
        fileName: req.file.originalname,
        caption: caption || ''
    });
    fs.unlinkSync(req.file.path);
    res.json({ status: true, message: 'File sent!' });
}));

// Kirim pesan ke grup
app.post('/send-group', asyncHandler(async (req, res) => {
    const { sessionId, groupId, message } = req.body;
    if (!sessionId || !groupId || !message) {
        return res.status(400).json({ status: false, message: 'sessionId, groupId & message is required!' });
    }
    const session = sessions[sessionId];
    if (!session) return res.status(400).json({ status: false, message: 'Session does not exist!' });
    await session.sock.sendMessage(groupId, { text: message });
    res.json({ status: true, message: 'Group message sent!' });
}));

// Daftar grup
app.get('/groups/:sessionId', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (!session) return res.status(400).json({ status: false, message: 'Session does not exist!' });
    const groups = await session.sock.groupFetchAllParticipating();
    res.json({ status: true, groups });
}));

// Logout/disconnect
app.post('/logout', asyncHandler(async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ status: false, message: 'sessionId is required!' });
    const session = sessions[sessionId];
    if (!session) return res.status(400).json({ status: false, message: 'Session does not exist!' });
    await session.sock.logout();
    delete sessions[sessionId];
    res.json({ status: true, message: 'Logged out!' });
}));

// Daftar pesan masuk (inbox)
app.get('/inbox/:sessionId', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    if (!sessions[sessionId]) {
        return res.status(400).json({ status: false, message: 'Session does not exist!' });
    }
    const inboxFile = `inbox_${sessionId}.json`;
    if (fs.existsSync(inboxFile)) {
        const inbox = JSON.parse(fs.readFileSync(inboxFile));
        res.json({ status: true, inbox });
    } else {
        res.json({ status: true, inbox: [] });
    }
}));

// Forward pesan dari inbox
app.post('/forward', asyncHandler(async (req, res) => {
    const { sessionId, messageId, to } = req.body;
    if (!sessionId || !messageId || !to) {
        return res.status(400).json({ status: false, message: 'sessionId, messageId & to is required!' });
    }
    const inboxFile = `inbox_${sessionId}.json`;
    if (!fs.existsSync(inboxFile)) throw new Error('No inbox found!');
    const inbox = JSON.parse(fs.readFileSync(inboxFile));
    const msg = inbox.find(x => x.id === messageId);
    if (!msg) throw new Error('Message not found!');
    const session = sessions[sessionId];
    if (!session) return res.status(400).json({ status: false, message: 'Session does not exist!' });
    await session.sock.sendMessage(formatNumber(to), { text: `[Forwarded]\n${msg.text}` });
    res.json({ status: true, message: 'Forwarded!' });
}));

// Info profil nomor
app.get('/profile/:sessionId/:number', asyncHandler(async (req, res) => {
    const { sessionId, number } = req.params;
    const jid = formatNumber(number);
    const session = sessions[sessionId];
    if (!session) return res.status(400).json({ status: false, message: 'Session does not exist!' });
    const ppUrl = await session.sock.profilePictureUrl(jid, 'image').catch(() => null);
    const info = await session.sock.onWhatsApp(jid);
    res.json({ status: true, profile: { jid, ppUrl, info } });
}));

// Cek status WA nomor
app.get('/check-number/:sessionId/:number', asyncHandler(async (req, res) => {
    const { sessionId, number } = req.params;
    const jid = formatNumber(number);
    const session = sessions[sessionId];
    if (!session) return res.status(400).json({ status: false, message: 'Session does not exist!' });
    const exists = await session.sock.onWhatsApp(jid);
    res.json({ status: true, exists });
}));

// Error handler global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: false, message: 'Internal Server Error', detail: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
});
