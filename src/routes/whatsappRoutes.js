const express = require('express');
const ctrl = require('../controllers/whatsappController');
const router = express.Router();

router.post('/start-session', ctrl.startSession);
router.post('/send-message', ctrl.sendMessage);
router.get('/check-session/:sessionId', ctrl.checkSession);
router.post('/reset-session', ctrl.resetSession);

module.exports = router;
