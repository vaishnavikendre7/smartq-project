// Citizen side of tokens, appointments, checklist and slots.
const crypto = require('crypto');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const v = require('../utils/validate');
const logActivity = require('../utils/log');
const { notify } = require('../utils/notify');
const { notifyApproaching } = require('../utils/turnAlerts');
const { expireOldTokens } = require('../utils/queue');
const { ACTIVE, changeStatus, presentToken, TOKEN_INCLUDE, cancelRule } = require('../utils/tokens');
const { enforceWorkingHours, maxAdvanceDays, notifyWhenAhead } = require('../config/env');
const T = require('../utils/time');

// ---------- checklist ----------
// GET /api/citizen/checklist/:serviceId
exports.getChecklist = asyncHandler(async (req, res) => {
  const serviceId = v.id(req.params.serviceId, 'Service ID');
  const docs = await prisma.requiredDocument.findMany({
    where: { serviceId }, orderBy: { id: 'asc' },
    include: { progress: { where: { userId: req.user.id } } }
  });
  res.json({
    success: true,
    documents: docs.map((d) => ({ id: d.id, name: d.name, isReady: d.progress.length > 0 && d.progress[0].isReady }))
  });
});

// PUT /api/citizen/checklist/:docId   body: { isReady: true/false }
exports.setChecklist = asyncHandler(async (req, res) => {
  const docId = v.id(req.params.docId, 'Document ID');
  const doc = await prisma.requiredDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new AppError('Document not found.', 404);
  const isReady = v.bool(req.body.isReady);
  await prisma.checklistProgress.upsert({
    where: { userId_requiredDocumentId: { userId: req.user.id, requiredDocumentId: docId } },
    create: { userId: req.user.id, requiredDocumentId: docId, isReady },
    update: { isReady }
  });
  res.json({ success: true, isReady });
});

// ---------- slots ----------
// GET /api/citizen/slots?officeId=1&serviceId=2&date=2026-10-12
exports.slots = asyncHandler(async (req, res) => {
  const officeId = v.id(req.query.officeId, 'Office ID');
  const serviceId = v.id(req.query.serviceId, 'Service ID');
  const date = req.query.date;
  if (!T.isValidDateStr(date)) throw new AppError('Date must look like 2026-10-12.');
  const today = T.todayStr();
  if (date < today || date > T.addDays(today, maxAdvanceDays)) {
    throw new AppError(`You can book from today up to ${maxAdvanceDays} days ahead.`);
  }
  const os = await prisma.officeService.findFirst({
    where: { officeId, serviceId, isAvailable: true, office: { isActive: true }, service: { isActive: true } },
    include: { office: true }
  });
  if (!os) throw new AppError('This service is not available at the selected office.', 400);
  const office = os.office;

  const used = await prisma.appointment.groupBy({
    by: ['slotTime'], _count: { _all: true },
    where: { officeId, serviceId, date: T.dateToDb(date), status: { not: 'CANCELLED' } }
  });
  const usedMap = Object.fromEntries(used.map((u) => [u.slotTime, u._count._all]));
  const now = new Date();
  const slots = T.generateSlots(office.openTime, office.closeTime, office.slotMinutes).map((time) => {
    const remaining = Math.max(0, office.slotCapacity - (usedMap[time] || 0));
    const past = T.slotInstant(date, time) <= now;
    return { time, remaining, available: !past && remaining > 0, reason: past ? 'Passed' : remaining === 0 ? 'Full' : null };
  });
  res.json({ success: true, date, openTime: office.openTime, closeTime: office.closeTime, slots });
});

// ---------- create token ----------
async function createTokenOnce({ user, office, service, os, date, slotTime }) {
  const tokenDate = T.dateToDb(date);
  const queueTime = slotTime ? T.slotInstant(date, slotTime) : new Date();

  return prisma.$transaction(async (tx) => {
    // 1) Safe sequence number. This row is locked until the transaction ends, so two citizens
    //    asking at the same moment are handled one after the other and never get the same number.
    await tx.$executeRaw`INSERT INTO TokenSequence (officeId, serviceId, seqDate, lastNumber)
      VALUES (${office.id}, ${service.id}, ${date}, 1) ON DUPLICATE KEY UPDATE lastNumber = lastNumber + 1`;
    const rows = await tx.$queryRaw`SELECT lastNumber FROM TokenSequence
      WHERE officeId = ${office.id} AND serviceId = ${service.id} AND seqDate = ${date}`;
    const seq = Number(rows[0].lastNumber);

    // 2) No duplicate active token for the same service and date
    const dup = await tx.token.findFirst({
      where: { userId: user.id, officeId: office.id, serviceId: service.id, tokenDate, status: { in: ACTIVE } }
    });
    if (dup) throw new AppError(`You already have an active token (${dup.tokenNumber}) for this service on this date.`, 409);

    // 3) Limits
    const officeCount = await tx.token.count({ where: { officeId: office.id, tokenDate, status: { not: 'CANCELLED' } } });
    if (officeCount >= office.dailyTokenLimit) throw new AppError('This office has reached its token limit for that day.', 409);
    const serviceCount = await tx.token.count({ where: { officeId: office.id, serviceId: service.id, tokenDate, status: { not: 'CANCELLED' } } });
    if (serviceCount >= os.dailyLimit) throw new AppError('This service has reached its token limit for that day.', 409);

    // 4) Appointment slot capacity (no overbooking)
    let appointment = null;
    if (slotTime) {
      const used = await tx.appointment.count({
        where: { officeId: office.id, serviceId: service.id, date: tokenDate, slotTime, status: { not: 'CANCELLED' } }
      });
      if (used >= office.slotCapacity) throw new AppError('This time slot is full. Please choose another slot.', 409);
      appointment = await tx.appointment.create({
        data: { userId: user.id, officeId: office.id, serviceId: service.id, date: tokenDate, slotTime }
      });
    }

    const token = await tx.token.create({
      data: {
        tokenNumber: `${service.code}-${String(seq).padStart(3, '0')}`,
        seq, userId: user.id, officeId: office.id, serviceId: service.id,
        appointmentId: appointment ? appointment.id : null,
        tokenDate, queueTime, verifyCode: crypto.randomBytes(12).toString('hex')
      }
    });
    await tx.tokenHistory.create({
      data: {
        tokenId: token.id, fromStatus: null, toStatus: 'WAITING', changedById: user.id,
        note: slotTime ? `Appointment booked for ${slotTime}` : 'Virtual token generated'
      }
    });
    return token;
  });
}

// POST /api/citizen/tokens
// body: { officeId, serviceId }                      -> virtual token for today
// body: { officeId, serviceId, date, slotTime }      -> appointment token
exports.create = asyncHandler(async (req, res) => {
  const officeId = v.id(req.body.officeId, 'Office');
  const serviceId = v.id(req.body.serviceId, 'Service');
  const slotTime = req.body.slotTime ? String(req.body.slotTime) : null;
  const today = T.todayStr();
  let date = today;

  if (slotTime) {
    if (!T.isValidHM(slotTime)) throw new AppError('Invalid time slot.');
    date = req.body.date;
    if (!T.isValidDateStr(date)) throw new AppError('Please choose a valid date.');
    if (date < today || date > T.addDays(today, maxAdvanceDays)) {
      throw new AppError(`You can book from today up to ${maxAdvanceDays} days ahead.`);
    }
  }

  const os = await prisma.officeService.findFirst({
    where: { officeId, serviceId, isAvailable: true, office: { isActive: true }, service: { isActive: true } },
    include: { office: true, service: true }
  });
  if (!os) throw new AppError('This service is not available at the selected office.', 400);
  const { office, service } = os;

  if (slotTime) {
    if (!T.generateSlots(office.openTime, office.closeTime, office.slotMinutes).includes(slotTime)) {
      throw new AppError('That time is not a valid slot for this office.');
    }
    if (T.slotInstant(date, slotTime) <= new Date()) throw new AppError('That time slot has already passed.');
  } else if (enforceWorkingHours && !T.isOfficeOpenNow(office)) {
    throw new AppError(
      `${office.name} is closed now (open ${office.openTime} to ${office.closeTime}). Book an appointment slot for a later time instead.`, 400
    );
  }

  let token;
  for (let attempt = 1; attempt <= 3; attempt += 1) {   // retry if MySQL reports a deadlock
    try {
      token = await createTokenOnce({ user: req.user, office, service, os, date, slotTime });
      break;
    } catch (err) {
      const deadlock = err.code === 'P2034' || /deadlock/i.test(err.message || '');
      if (!deadlock || attempt === 3) throw err;
    }
  }

  const full = await prisma.token.findUnique({ where: { id: token.id }, include: TOKEN_INCLUDE });
  await logActivity(req.user.id, 'TOKEN_CREATED', `${token.tokenNumber} at ${office.name}`);
  await notify(
    req.user.id, 'Token generated',
    `Your token ${token.tokenNumber} for ${service.name} at ${office.name} is confirmed for ${date}${slotTime ? ` at ${slotTime}` : ''}.`,
    'TOKEN'
  );
  await notifyApproaching(office.id, service.id, token.tokenDate);
  res.status(201).json({ success: true, token: await presentToken(full) });
});

// GET /api/citizen/tokens
exports.myTokens = asyncHandler(async (req, res) => {
  await expireOldTokens();
  const rows = await prisma.token.findMany({
    where: { userId: req.user.id }, orderBy: [{ tokenDate: 'desc' }, { id: 'desc' }], take: 100, include: TOKEN_INCLUDE
  });
  const tokens = [];
  for (const t of rows) tokens.push(await presentToken(t));

  // "Your turn is near" alerts, saved once per token
  for (const t of tokens) {
    if (t.status === 'WAITING' && t.peopleAhead !== null && t.estimatedWaitMinutes !== null && t.peopleAhead <= notifyWhenAhead) {
      await notify(req.user.id, 'Your turn is near',
        `Token ${t.tokenNumber}: ${t.peopleAhead === 0 ? 'you are next' : `${t.peopleAhead} people ahead of you`}.`, 'QUEUE', `near-${t.id}`);
    }
  }
  res.json({
    success: true,
    current: tokens.filter((t) => ACTIVE.includes(t.status)),
    history: tokens.filter((t) => !ACTIVE.includes(t.status))
  });
});

// GET /api/citizen/tokens/:id
exports.tokenDetail = asyncHandler(async (req, res) => {
  await expireOldTokens();
  const id = v.id(req.params.id, 'Token ID');
  const t = await prisma.token.findFirst({
    where: { id, userId: req.user.id },        // citizens can only see their own tokens
    include: { ...TOKEN_INCLUDE, history: { orderBy: { id: 'asc' } }, feedback: true }
  });
  if (!t) throw new AppError('Token not found.', 404);
  res.json({
    success: true,
    token: await presentToken(t),
    history: t.history.map((h) => ({ id: h.id, from: h.fromStatus, to: h.toStatus, note: h.note, at: h.createdAt })),
    feedback: t.feedback ? { rating: t.feedback.rating, comment: t.feedback.comment } : null
  });
});

// PATCH /api/citizen/tokens/:id/cancel
exports.cancel = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Token ID');
  const t = await prisma.token.findFirst({ where: { id, userId: req.user.id }, include: TOKEN_INCLUDE });
  if (!t) throw new AppError('Token not found.', 404);
  const rule = cancelRule(t);
  if (!rule.canCancel) throw new AppError(rule.reason, 409);

  await prisma.$transaction((tx) => changeStatus(tx, t, 'CANCELLED', req.user.id, 'Cancelled by citizen'));
  await logActivity(req.user.id, 'TOKEN_CANCELLED', t.tokenNumber);
  await notify(req.user.id, 'Token cancelled', `Your token ${t.tokenNumber} was cancelled.`, 'TOKEN');
  await notifyApproaching(t.officeId, t.serviceId, t.tokenDate);
  res.json({ success: true, message: 'Token cancelled.' });
});

// ---------- feedback ----------
// POST /api/citizen/feedback   body: { tokenId, rating (1-5), comment }
exports.giveFeedback = asyncHandler(async (req, res) => {
  const tokenId = v.id(req.body.tokenId, 'Token');
  const rating = v.int(req.body.rating, 'Rating', { min: 1, max: 5 });
  const comment = v.optionalText(req.body.comment, 'Comment', 500);
  const t = await prisma.token.findFirst({ where: { id: tokenId, userId: req.user.id } });
  if (!t) throw new AppError('Token not found.', 404);
  if (t.status !== 'COMPLETED') throw new AppError('You can rate a service only after it is completed.', 409);
  if (await prisma.feedback.findUnique({ where: { tokenId } })) throw new AppError('You already gave feedback for this token.', 409);

  await prisma.feedback.create({ data: { userId: req.user.id, officeId: t.officeId, tokenId, rating, comment } });
  res.status(201).json({ success: true, message: 'Thank you for your feedback!' });
});

// GET /api/citizen/feedback  (my feedback list)
exports.myFeedback = asyncHandler(async (req, res) => {
  const rows = await prisma.feedback.findMany({
    where: { userId: req.user.id }, orderBy: { id: 'desc' },
    include: { token: { select: { tokenNumber: true } }, office: { select: { name: true } } }
  });
  res.json({ success: true, feedback: rows.map((f) => ({
    id: f.id, rating: f.rating, comment: f.comment, createdAt: f.createdAt, tokenNumber: f.token.tokenNumber, office: f.office.name
  })) });
});

// ---------- notifications ----------
// GET /api/citizen/notifications
exports.notifications = asyncHandler(async (req, res) => {
  const list = await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { id: 'desc' }, take: 50 });
  const unread = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
  res.json({ success: true, unread, notifications: list });
});
// PATCH /api/citizen/notifications/:id/read
exports.markRead = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Notification ID');
  await prisma.notification.updateMany({ where: { id, userId: req.user.id }, data: { isRead: true } });
  res.json({ success: true });
});
// PATCH /api/citizen/notifications/read-all
exports.markAllRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ success: true });
});
