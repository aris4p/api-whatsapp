module.exports = (number) => {
    let cleanNumber = number.replace(/\D/g, '');

    if (cleanNumber.startsWith('0')) {
        cleanNumber = '62' + cleanNumber.slice(1);
    } else if (!cleanNumber.startsWith('62')) {
        throw new Error('Nomor harus diawali dengan 62 atau 0.');
    }

    return `${cleanNumber}@s.whatsapp.net`;
};