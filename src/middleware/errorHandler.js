module.exports = (err, req, res, next) => {
    console.error(err.stack);
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ status: false, message: 'Invalid JSON format!' });
    }
    res.status(500).json({ status: false, message: 'Internal Server Error', detail: err.message });
};
