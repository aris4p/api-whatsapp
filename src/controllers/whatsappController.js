const service = require('../services/whatsappService');
const sessionRepo = require('../repositories/whatsappSessionRepo');
const formatNumber = require('../utils/formatNumber');


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