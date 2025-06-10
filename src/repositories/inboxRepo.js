const fs = require('fs');

module.exports = {
    saveMessage(sessionId, message) {
        const file = `inbox_${sessionId}.json`;
        const inbox = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
        inbox.push(message);
        fs.writeFileSync(file, JSON.stringify(inbox, null, 2));
    },

    getInbox(sessionId) {
        const file = `inbox_${sessionId}.json`;
        return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
    }
};
