const express = require('express');
const whatsappRoutes = require('./src/routes/whatsappRoutes');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
app.use(express.json());

app.use('/api', whatsappRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
