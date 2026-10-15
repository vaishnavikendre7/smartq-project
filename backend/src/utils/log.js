// Saves important actions in the ActivityLog table (never breaks the main request).
const prisma = require('../config/prisma');

module.exports = async function logActivity(userId, action, details = null) {
  try {
    await prisma.activityLog.create({
      data: { userId: userId || null, action, details: details ? String(details).slice(0, 500) : null }
    });
  } catch (err) {
    console.error('Could not write activity log:', err.message);
  }
};
