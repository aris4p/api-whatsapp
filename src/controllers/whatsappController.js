const service = require('../services/whatsappService');
const sessionRepo = require('../repositories/whatsappSessionRepo');
const inboxRepo = require('../repositories/inboxRepo');
const formatNumber = require('../utils/formatNumber');
const autoReply = require('../utils/autoReply');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

exports.startSession = async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ status: false, message: 'sessionId is required!' });
    if (sessionRepo.exists(sessionId)) return res.status(400).json({ status: false, message: 'Session already exists!' });
    await service.startSock(sessionId);
    res.json({ status: true, message: `Session ${sessionId} started!` });
};

exports.sendMessage = async (req, res) => {
    const { sessionId, number, message } = req.body;

    if (!sessionId || !number || !message) {
        return res.status(400).json({ status: false, message: 'sessionId, number & message are required!' });
    }

    const session = sessionRepo.get(sessionId);
    if (!session || !session.sock?.user) {
        return res.status(400).json({ status: false, message: 'Session does not exist or not connected!' });
    }

    let formattedNumber;
    try {
        formattedNumber = formatNumber(number);
    } catch (error) {
        return res.status(400).json({ status: false, message: error.message });
    }

    try {
        await session.sock.sendMessage(formattedNumber, { text: message });
        return res.json({ status: true, message: 'Message sent!' });
    } catch (error) {
        console.error("Send Message Error:", error);
        return res.status(500).json({ status: false, message: 'Failed to send message!', detail: error.message });
    }
};

exports.checkSession = async (req, res) => {
    const { sessionId } = req.params;
    const session = sessionRepo.get(sessionId);

    if (!session) {
        return res.json({ status: false, message: 'Session does not exist!' });
    }

    res.json({
        status: session.sock?.user ? 'connected' : 'disconnected',
        user: session.sock?.user || null
    });
};


exports.resetSession = async (req, res) => {
   const { sessionId } = req.body;

    if (!sessionId) return res.status(400).json({ status: false, message: 'sessionId is required!' });

    const session = sessionRepo.get(sessionId);
    if (!session) return res.status(400).json({ status: false, message: 'Session does not exist!' });

    try {
        await service.resetSession(sessionId);  // dari service
        await service.startSock(sessionId);     // dari service
        return res.json({ status: true, message: `Session ${sessionId} reset! Silakan scan ulang QR.` });
    } catch (err) {
        console.error('Reset session error:', err);
        return res.status(500).json({ status: false, message: 'Gagal reset session.', detail: err.message });
    }
}

exports.getQrCode = async (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId) {
        return res.status(400).json({ status: false, message: 'sessionId is required!' });
    }

    const session = sessionRepo.get(sessionId);

    if (!session) {
        return res.status(404).json({ status: false, message: 'Session does not exist!' });
    }

    if (!session.lastQr) {
        return res.status(400).json({ status: false, message: 'QR code tidak tersedia atau sesi sudah login.' });
    }

    try {
        const qrPng = await QRCode.toDataURL(session.lastQr);
        return res.json({
            status: true,
            qr: session.lastQr,
            qr_image: qrPng
        });
    } catch (err) {
        console.error('QR code generation error:', err);
        return res.status(500).json({ status: false, message: 'Failed to generate QR code.', detail: err.message });
    }
};

exports.logout = async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ status: false, message: 'sessionId is required!' });
    }

    const session = sessionRepo.get(sessionId);
    if (!session) {
        return res.status(404).json({ status: false, message: 'Session does not exist!' });
    }

    try {
        if (session.sock?.logout) {
            await session.sock.logout();
        }
        sessionRepo.remove(sessionId);
        return res.json({ status: true, message: `Session ${sessionId} logged out!` });
    } catch (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ status: false, message: 'Failed to logout.', detail: err.message });
    }
}

exports.sendMedia = async (req, res) => {
    const { sessionId, number, caption } = req.body;

    if (!sessionId || !number || !req.file) {
        return res.status(400).json({
            status: false,
            message: 'sessionId, number & media file (multipart/form-data) are required!'
        });
    }

    const session = sessionRepo.get(sessionId);
    if (!session || !session.sock?.user) {
        return res.status(400).json({ status: false, message: 'Session does not exist or is not connected!' });
    }

    let formattedNumber;
    try {
        formattedNumber = formatNumber(number);
    } catch (error) {
        return res.status(400).json({ status: false, message: error.message });
    }

    const mime = req.file.mimetype;
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const fileName = req.file.originalname;

    let mediaMessage = {};

    if (mime.startsWith('image/')) {
        mediaMessage = { image: buffer, caption: caption || '' };
    } else if (mime.startsWith('video/')) {
        mediaMessage = { video: buffer, caption: caption || '' };
    } else if (mime.startsWith('audio/')) {
        mediaMessage = { audio: buffer };
    } else {
        mediaMessage = {
            document: buffer,
            mimetype: mime,
            fileName: fileName,
            caption: caption || ''
        };
    }

    try {
        await session.sock.sendMessage(formattedNumber, mediaMessage);
        fs.unlinkSync(filePath);
        return res.json({ status: true, message: 'Media sent successfully!' });
    } catch (error) {
        console.error('Send media failed:', error);
        fs.unlinkSync(filePath);
        return res.status(500).json({
            status: false,
            message: 'Failed to send media.',
            detail: error.message
        });
    }
}

exports.getGroups = async (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId) {
        return res.status(400).json({
            status: false,
            message: 'sessionId is required!'
        });
    }

    const session = sessionRepo.get(sessionId);

    if (!session || !session.sock?.user) {
        return res.status(400).json({
            status: false,
            message: 'Session does not exist or is not connected!'
        });
    }

    try {
        const groupsData = await session.sock.groupFetchAllParticipating();

        // Optional: convert from object to array if needed
        const groups = Object.values(groupsData);

        return res.json({ status: true, groups });
    } catch (error) {
        console.error('Error fetching groups:', error);
        return res.status(500).json({
            status: false,
            message: 'Failed to fetch groups.',
            detail: error.message
        });
    }
};


exports.sendGroupMessage = async (req, res) => {
    const { sessionId, groupId, mentions, template } = req.body;

    if (!sessionId || !groupId || !template || !Array.isArray(mentions)) {
        return res.status(400).json({
            status: false,
            message: 'sessionId, groupId, template & mentions[] are required!'
        });
    }

    const session = sessionRepo.get(sessionId);
    if (!session || !session.sock?.user) {
        return res.status(400).json({
            status: false,
            message: 'Session does not exist or is not connected!'
        });
    }

    try {
        const mentionJids = mentions.map(num => `${num.replace(/\D/g, '')}@s.whatsapp.net`);
        const groupMetadata = await session.sock.groupMetadata(groupId);

        // Ambil nama dari metadata
        const mentionNames = mentionJids.map(jid => {
            const participant = groupMetadata.participants.find(p => p.id === jid);
            return `@${participant?.name || participant?.notify || jid.split('@')[0]}`;
        });

        // Ganti placeholder {0}, {1}, {2} dengan nama yang ditemukan
        let finalMessageText = template;
        mentionNames.forEach((name, index) => {
            const placeholder = new RegExp(`\\{${index}\\}`, 'g');
            finalMessageText = finalMessageText.replace(placeholder, name);
        });

        await session.sock.sendMessage(groupId, {
            text: finalMessageText,
            mentions: mentionJids
        });

        return res.json({
            status: true,
            message: 'Group message sent with template!'
        });

    } catch (error) {
        console.error('Send group message error:', error);
        return res.status(500).json({
            status: false,
            message: 'Failed to send message to group.',
            detail: error.message
        });
    }
};




exports.getInbox = async (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId) {
        return res.status(400).json({ status: false, message: 'sessionId is required!' });
    }

    const session = sessionRepo.get(sessionId);
    if (!session) {
        return res.status(400).json({ status: false, message: 'Session does not exist!' });
    }

    try {
        const inbox = inboxRepo.getInbox(sessionId);
        return res.json({ status: true, inbox });
    } catch (error) {
        console.error('Get inbox error:', error);
        return res.status(500).json({
            status: false,
            message: 'Failed to get inbox.',
            detail: error.message
        });
    }
}

exports.getAutoReplyRules = async (req, res) => {
     try {
        const rules = autoReply.getAutoReplyRules();
        return res.json({ status: true, rules });
    } catch (error) {
        console.error('Error loading auto-reply rules:', error);
        return res.status(500).json({
            status: false,
            message: 'Failed to load auto-reply rules.',
            detail: error.message
        });
    }
}

exports.setAutoReplyRules = async (req, res) => {
    const { rules } = req.body;

    if (!Array.isArray(rules)) {
        return res.status(400).json({
            status: false,
            message: 'rules should be an array!'
        });
    }

    try {
        autoReply.saveAutoReplyRules(rules);
        return res.json({
            status: true,
            message: 'Auto-reply rules updated.',
            rules
        });
    } catch (error) {
        console.error('Failed to save auto-reply rules:', error);
        return res.status(500).json({
            status: false,
            message: 'Failed to save auto-reply rules.',
            detail: error.message
        });
    }
}

exports.getProfileInfo = async (req, res) => {
    const { sessionId, number } = req.params;

    if (!sessionId || !number) {
        return res.status(400).json({
            status: false,
            message: 'sessionId and number are required!'
        });
    }

    const session = sessionRepo.get(sessionId);
    if (!session || !session.sock?.user) {
        return res.status(400).json({
            status: false,
            message: 'Session does not exist or is not connected!'
        });
    }

    let jid;
    try {
        jid = formatNumber(number);
    } catch (error) {
        return res.status(400).json({
            status: false,
            message: error.message
        });
    }

    try {
        const ppUrl = await session.sock.profilePictureUrl(jid, 'image').catch(() => null);
        const info = await session.sock.onWhatsApp(jid);
        const exists = info?.[0]?.exists ?? false;

        return res.json({
            status: true,
            profile: {
                jid,
                exists,
                ppUrl,
                info: info?.[0] || null
            }
        });
    } catch (error) {
        console.error('Error fetching profile info:', error);
        return res.status(500).json({
            status: false,
            message: 'Failed to get profile info.',
            detail: error.message
        });
    }
}

exports.checkNumber = async (req, res) => {
     const { sessionId, number } = req.params;

    if (!sessionId || !number) {
        return res.status(400).json({
            status: false,
            message: 'sessionId and number are required!'
        });
    }

    const session = sessionRepo.get(sessionId);
    if (!session || !session.sock?.user) {
        return res.status(400).json({
            status: false,
            message: 'Session does not exist or is not connected!'
        });
    }

    let jid;
    try {
        jid = formatNumber(number);
    } catch (err) {
        return res.status(400).json({
            status: false,
            message: err.message
        });
    }

    try {
        const result = await session.sock.onWhatsApp(jid);
        return res.json({
            status: true,
            exists: result?.[0]?.exists || false,
            data: result[0] || null
        });
    } catch (error) {
        console.error('Error checking number:', error);
        return res.status(500).json({
            status: false,
            message: 'Failed to check number.',
            detail: error.message
        });
    }
}