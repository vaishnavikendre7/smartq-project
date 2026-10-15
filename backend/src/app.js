const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { clientOrigin } = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/api', require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
