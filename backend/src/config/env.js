// Loads the .env file and checks that the important settings exist.
require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing .env settings: ${missing.join(', ')}`);
  console.error('Copy backend/.env.example to backend/.env and fill in the values.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

module.exports = {
  port: num(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  enforceWorkingHours: String(process.env.ENFORCE_WORKING_HOURS || 'true').split('#')[0].trim() !== 'false',
  maxAdvanceDays: num(String(process.env.MAX_ADVANCE_DAYS || '').split('#')[0].trim(), 7),
  callAheadMinutes: num(String(process.env.CALL_AHEAD_MINUTES || '').split('#')[0].trim(), 30),
  cancelBeforeMinutes: num(String(process.env.CANCEL_BEFORE_MINUTES || '').split('#')[0].trim(), 30),
  notifyWhenAhead: num(String(process.env.NOTIFY_WHEN_AHEAD || '').split('#')[0].trim(), 2),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'SmartQ <no-reply@smartq.demo>'
  }
};
