const { nodeEnv } = require('../config/env');

const notFound = (req, res) =>
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });

// One place that turns errors into safe JSON. Never leaks passwords, SQL or stack traces.
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.isOperational) return res.status(err.statusCode).json({ success: false, message: err.message });
  if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'This record already exists.' });
  if (err.code === 'P2003') return res.status(409).json({ success: false, message: 'This record is linked to other data.' });
  if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Record not found.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Invalid JSON in request.' });
  console.error('Unexpected error:', nodeEnv === 'development' ? err : err.message);
  res.status(500).json({ success: false, message: 'Something went wrong on the server.' });
};

module.exports = { notFound, errorHandler };
