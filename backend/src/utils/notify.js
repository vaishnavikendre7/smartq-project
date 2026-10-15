// In-app notifications are always saved in MySQL. If SMTP settings exist in .env, an email is also sent.
const nodemailer = require('nodemailer');
const prisma = require('../config/prisma');
const { smtp } = require('../config/env');

const transporter = smtp.host
  ? nodemailer.createTransport({
      host: smtp.host, port: smtp.port, secure: smtp.port === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
    })
  : null;

async function sendEmail(userId, title, message) {
  if (!transporter) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return;
    await transporter.sendMail({ from: smtp.from, to: user.email, subject: `SmartQ: ${title}`, text: message });
  } catch (err) {
    console.error('Email could not be sent:', err.message); // in-app notification still exists
  }
}

// dedupeKey makes sure the same notification is not created twice (e.g. "turn near")
async function notify(userId, title, message, type = 'INFO', dedupeKey = null) {
  try {
    await prisma.notification.create({ data: { userId, title, message: message.slice(0, 500), type, dedupeKey } });
  } catch (err) {
    if (err.code === 'P2002') return false; // already sent
    console.error('Could not create notification:', err.message);
    return false;
  }
  sendEmail(userId, title, message); // not awaited on purpose
  return true;
}

module.exports = { notify };
