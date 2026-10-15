// Everything that changes or describes a token lives here, so the rules stay in ONE place.
const prisma = require('../config/prisma');
const AppError = require('./AppError');
const { cancelBeforeMinutes } = require('../config/env');
const { dbToStr, slotInstant } = require('./time');
const { queueInfo } = require('./queue');

// Allowed status changes
const FLOW = {
  WAITING: ['CALLED', 'CANCELLED', 'EXPIRED'],
  CALLED: ['SERVING', 'SKIPPED', 'EXPIRED'],
  SERVING: ['COMPLETED', 'EXPIRED']
};
const ACTIVE = ['WAITING', 'CALLED', 'SERVING'];
const APPOINTMENT_STATUS = { COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED', SKIPPED: 'MISSED', EXPIRED: 'MISSED' };

// Changes a token's status, saves history, and keeps the appointment in sync.
// "where status = old status" stops two people changing the same token at once.
async function changeStatus(tx, token, to, userId, note, data = {}) {
  if (!(FLOW[token.status] || []).includes(to)) {
    throw new AppError(`A ${token.status.toLowerCase()} token cannot be changed to ${to.toLowerCase()}.`, 409);
  }
  const r = await tx.token.updateMany({ where: { id: token.id, status: token.status }, data: { status: to, ...data } });
  if (r.count !== 1) throw new AppError('This token was just changed by someone else. Please refresh.', 409);
  await tx.tokenHistory.create({
    data: { tokenId: token.id, fromStatus: token.status, toStatus: to, changedById: userId || null, note: note || null }
  });
  if (token.appointmentId && APPOINTMENT_STATUS[to]) {
    await tx.appointment.update({ where: { id: token.appointmentId }, data: { status: APPOINTMENT_STATUS[to] } });
  }
  return tx.token.findUnique({ where: { id: token.id } });
}

function cancelRule(token) {
  if (token.status !== 'WAITING') return { canCancel: false, reason: 'Only waiting tokens can be cancelled.' };
  if (token.appointment) {
    const minutesLeft = (slotInstant(dbToStr(token.tokenDate), token.appointment.slotTime) - Date.now()) / 60000;
    if (minutesLeft > 0 && minutesLeft < cancelBeforeMinutes) {
      return { canCancel: false, reason: `Appointments cannot be cancelled within ${cancelBeforeMinutes} minutes of the slot.` };
    }
  }
  return { canCancel: true, reason: null };
}

// Token as the frontend needs it (token must be loaded with office, service, appointment)
async function presentToken(t) {
  const q = await queueInfo(t, t.service);
  const rule = cancelRule(t);
  return {
    id: t.id,
    tokenNumber: t.tokenNumber,
    status: t.status,
    tokenDate: dbToStr(t.tokenDate),
    slotTime: t.appointment ? t.appointment.slotTime : null,
    isVirtual: !t.appointment,
    office: { id: t.office.id, name: t.office.name, address: t.office.address },
    service: { id: t.service.id, name: t.service.name, code: t.service.code },
    qrValue: `SMARTQ|${t.id}|${t.verifyCode}`,
    isVerified: t.isVerified,
    createdAt: t.createdAt,
    calledAt: t.calledAt,
    servingAt: t.servingAt,
    completedAt: t.completedAt,
    peopleAhead: q.peopleAhead,
    position: q.position,
    estimatedWaitMinutes: q.estimatedWaitMinutes,
    estimateSource: q.estimateSource,
    canCancel: rule.canCancel,
    cancelNote: rule.reason
  };
}

const TOKEN_INCLUDE = {
  office: { select: { id: true, name: true, address: true } },
  service: { select: { id: true, name: true, code: true, avgMinutes: true } },
  appointment: true
};

module.exports = { FLOW, ACTIVE, changeStatus, presentToken, TOKEN_INCLUDE, cancelRule };
