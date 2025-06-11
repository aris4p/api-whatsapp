const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/whatsappController');

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // untuk media upload

// Session & connection
router.post('/start-session', ctrl.startSession);
router.post('/reset-session', ctrl.resetSession);
router.get('/check-session/:sessionId', ctrl.checkSession);
router.get('/qr/:sessionId', ctrl.getQrCode);
router.post('/logout', ctrl.logout);

// Messaging
router.post('/send-message', ctrl.sendMessage);
router.post('/send-media', upload.single('file'), ctrl.sendMedia); // gunakan multer untuk media
// Jika ingin tambah jenis upload lain (image, document, dll), cukup ubah nama field saja

module.exports = router;
