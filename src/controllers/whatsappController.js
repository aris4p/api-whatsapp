const service = require('../services/whatsappService');
const sessionRepo = require('../repositories/whatsappSessionRepo');
const formatNumber = require('../utils/formatNumber');
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