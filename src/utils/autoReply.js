const fs = require('fs');

exports.getAutoReplyRules = () => fs.existsSync('autoreply.json')
    ? JSON.parse(fs.readFileSync('autoreply.json'))
    : [];

exports.saveAutoReplyRules = (rules) => {
    fs.writeFileSync('autoreply.json', JSON.stringify(rules, null, 2));
};
