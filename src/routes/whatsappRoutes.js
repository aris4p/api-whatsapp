const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/whatsappController');
const cors = require('cors');

console.log(ctrl);


const router = express.Router();
const upload = multer({ dest: 'uploads/' });

app.use(cors({
  origin: '*', // atau '*' untuk semua origin
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
// ───────── Session Management ─────────
router.post('/start-session', ctrl.startSession);
router.post('/reset-session', ctrl.resetSession);
router.get('/check-session/:sessionId', ctrl.checkSession);
router.get('/qr/:sessionId', ctrl.getQrCode);
router.post('/logout', ctrl.logout);

// ───────── Messaging ─────────
router.post('/send-message', ctrl.sendMessage);
router.post('/send-media', upload.single('file'), ctrl.sendMedia);

// // ───────── Auto Reply ─────────
router.get('/auto-reply', ctrl.getAutoReplyRules);
router.post('/auto-reply', ctrl.setAutoReplyRules);

// // ───────── Inbox ─────────
router.get('/inbox/:sessionId', ctrl.getInbox);
// router.post('/forward', ctrl.forwardMessage);

// // ───────── Groups ─────────
router.get('/groups/:sessionId', ctrl.getGroups);
router.post('/groups/send-message', ctrl.sendGroupMessage);

// // ───────── Contact Info / WA Check ─────────
router.get('/profile/:sessionId/:number', ctrl.getProfileInfo);
router.get('/check-number/:sessionId/:number', ctrl.checkNumber);

module.exports = router;
