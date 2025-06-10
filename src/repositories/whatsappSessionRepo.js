const sessions = {};

module.exports = {
    add(sessionId, sessionData) { sessions[sessionId] = sessionData; },
    get(sessionId) { return sessions[sessionId]; },
    remove(sessionId) { delete sessions[sessionId]; },
    exists(sessionId) { return sessionId in sessions; }
};
