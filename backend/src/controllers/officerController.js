// Officer work: queue, calling tokens, QR / token verification, statistics.
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const v = require('../utils/validate');
const logActivity = require('../utils/log');
const { notify } = require('../utils/notify');
const { notifyApproaching } = require('../utils/turnAlerts');
const { officerScope, pairsWhere, canAccess, expireOldTokens } = require('../utils/queue');
const { changeStatus } = require('../utils/tokens');
const { callAheadMinutes } = require('../config/env');
const T = require('../utils/time');

const tokenRow = (t, extra = {}) => ({
  id: t.id, tokenNumber: t.tokenNumber, status: t.status, tokenDate: T.dbToStr(t.tokenDate),
  slotTime: t.appointment ? t.appointment.slotTime : null, isVirtual: !t.appointment,
  service: t.service.name, office: t.office.name, citizen: t.user ? t.user.name : undefined,
  citizenPhone: t.user ? t.user.phone : undefined, isVerified: t.isVerified,
  createdAt: t.createdAt, calledAt: t.calledAt, servingAt: t.servingAt, completedAt: t.completedAt, ...extra
});
const INCLUDE = {
  service: { select: { id: true, name: true } }, office: { select: { id: true, name: true } },
  appointment: true, user: { select: { id: true, name: true, phone: true } }
};

// GET /api/officer/me  -> assigned office, departments and services
exports.me = asyncHandler(async (req, res) => {
  const { assignments, pairs } = await officerScope(req.user.id);
  const serviceIds = [...new Set(pairs.map((p) => p.serviceId))];
  const services = await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true, code: true } });
  res.json({
    success: true,
    assignments: assignments.map((a) => ({ id: a.id, office: a.office.name, department: a.department.name })),
    services
  });
});

// GET /api/officer/queue  -> everything the officer dashboard needs
exports.queue = asyncHandler(async (req, res) => {
  await expireOldTokens();
  const { assignments, pairs } = await officerScope(req.user.id);
  const today = T.dateToDb(T.todayStr());
  const scope = pairsWhere(pairs);

  const current = await prisma.token.findFirst({
    where: { handledById: req.user.id, status: { in: ['CALLED', 'SERVING'] } }, include: INCLUDE
  });
  let currentApplication = null;
  if (current) {
    const app = await prisma.application.findFirst({
      where: { userId: current.userId, officeId: current.officeId, serviceId: current.service.id },
      orderBy: { id: 'desc' }
    });
    if (app) currentApplication = { id: app.id, applicationCode: app.applicationCode, status: app.status };
  }

  const waiting = await prisma.token.findMany({
    where: { tokenDate: today, status: 'WAITING', ...scope },
    orderBy: [{ queueTime: 'asc' }, { id: 'asc' }], include: INCLUDE, take: 200
  });
  const limit = Date.now() + callAheadMinutes * 60000;
  const recent = await prisma.token.findMany({
    where: { handledById: req.user.id, tokenDate: today, status: { in: ['COMPLETED', 'SKIPPED'] } },
    orderBy: { id: 'desc' }, take: 30, include: INCLUDE
  });

  const grouped = await prisma.token.groupBy({ by: ['status'], where: { tokenDate: today, ...scope }, _count: { _all: true } });
  const stats = { WAITING: 0, CALLED: 0, SERVING: 0, COMPLETED: 0, SKIPPED: 0, CANCELLED: 0, EXPIRED: 0 };
  grouped.forEach((g) => { stats[g.status] = g._count._all; });

  res.json({
    success: true,
    date: T.todayStr(),
    assignments: assignments.map((a) => ({ office: a.office.name, department: a.department.name })),
    hasServices: pairs.length > 0,
    callAheadMinutes,
    current: current ? tokenRow(current, { application: currentApplication }) : null,
    waiting: waiting.map((t, i) => tokenRow(t, { order: i + 1, eligible: t.queueTime.getTime() <= limit })),
    recent: recent.map((t) => tokenRow(t)),
    stats: { ...stats, totalToday: Object.values(stats).reduce((a, b) => a + b, 0) }
  });
});

// POST /api/officer/queue/call-next
exports.callNext = asyncHandler(async (req, res) => {
  await expireOldTokens();
  const { pairs } = await officerScope(req.user.id);
  if (!pairs.length) throw new AppError('No services are assigned to you yet. Please contact the administrator.', 403);

  const busy = await prisma.token.findFirst({ where: { handledById: req.user.id, status: { in: ['CALLED', 'SERVING'] } } });
  if (busy) throw new AppError(`Finish token ${busy.tokenNumber} first (complete or skip it) before calling the next one.`, 409);

  const today = T.dateToDb(T.todayStr());
  const limit = new Date(Date.now() + callAheadMinutes * 60000);
  let called = null;
  for (let attempt = 0; attempt < 3 && !called; attempt += 1) {
    const next = await prisma.token.findFirst({
      where: { tokenDate: today, status: 'WAITING', queueTime: { lte: limit }, ...pairsWhere(pairs) },
      orderBy: [{ queueTime: 'asc' }, { id: 'asc' }]
    });
    if (!next) throw new AppError(`No eligible waiting token. (Appointment tokens can be called ${callAheadMinutes} minutes before their slot.)`, 404);
    try {
      called = await prisma.$transaction((tx) =>
        changeStatus(tx, next, 'CALLED', req.user.id, 'Called by officer', { calledAt: new Date(), handledById: req.user.id }));
    } catch (err) {
      if (err.statusCode !== 409) throw err; // another officer got it first: try the next token
    }
  }
  if (!called) throw new AppError('Could not call a token. Please try again.', 409);

  const full = await prisma.token.findUnique({ where: { id: called.id }, include: INCLUDE });
  await logActivity(req.user.id, 'TOKEN_CALLED', called.tokenNumber);
  await notify(full.user.id, 'It is your turn!', `Token ${called.tokenNumber} (${full.service.name}) is called. Please go to the ${full.office.name} counter now.`, 'QUEUE');
  await notifyApproaching(called.officeId, called.serviceId, called.tokenDate);
  res.json({ success: true, token: tokenRow(full) });
});

// Loads a token the officer is allowed to work on
async function ownToken(req) {
  const id = v.id(req.params.id, 'Token ID');
  const { pairs } = await officerScope(req.user.id);
  const t = await prisma.token.findUnique({ where: { id }, include: INCLUDE });
  if (!t || !canAccess(pairs, t.officeId, t.serviceId)) throw new AppError('Token not found in your assigned services.', 404);
  if (t.handledById !== req.user.id) throw new AppError('This token is not called by you.', 403);
  return t;
}

// PATCH /api/officer/tokens/:id/serving
exports.serving = asyncHandler(async (req, res) => {
  const t = await ownToken(req);
  const updated = await prisma.$transaction((tx) => changeStatus(tx, t, 'SERVING', req.user.id, 'Service started', { servingAt: new Date() }));
  await logActivity(req.user.id, 'TOKEN_SERVING', t.tokenNumber);
  res.json({ success: true, token: tokenRow({ ...t, ...updated }) });
});

// PATCH /api/officer/tokens/:id/complete
exports.complete = asyncHandler(async (req, res) => {
  const t = await ownToken(req);
  const updated = await prisma.$transaction((tx) => changeStatus(tx, t, 'COMPLETED', req.user.id, 'Service completed', { completedAt: new Date() }));
  await logActivity(req.user.id, 'TOKEN_COMPLETED', t.tokenNumber);
  await notify(t.user.id, 'Service completed', `Token ${t.tokenNumber} (${t.service.name}) is completed. Please rate your experience.`, 'TOKEN');
  await notifyApproaching(t.officeId, t.service.id, t.tokenDate);
  res.json({ success: true, token: tokenRow({ ...t, ...updated }) });
});

// PATCH /api/officer/tokens/:id/skip   (citizen did not arrive after being called)
exports.skip = asyncHandler(async (req, res) => {
  const t = await ownToken(req);
  const note = v.optionalText(req.body && req.body.note, 'Note', 200) || 'Citizen did not arrive';
  const updated = await prisma.$transaction((tx) => changeStatus(tx, t, 'SKIPPED', req.user.id, note));
  await logActivity(req.user.id, 'TOKEN_SKIPPED', t.tokenNumber);
  await notify(t.user.id, 'Token skipped', `Token ${t.tokenNumber} was skipped because you did not arrive. Please generate a new token.`, 'TOKEN');
  await notifyApproaching(t.officeId, t.service.id, t.tokenDate);
  res.json({ success: true, token: tokenRow({ ...t, ...updated }) });
});

// POST /api/officer/tokens/verify   body: { code }   (scanned QR text, verify code, or token number)
exports.verify = asyncHandler(async (req, res) => {
  await expireOldTokens();
  let code = v.text(req.body.code, 'Code', 3, 100);
  const { pairs } = await officerScope(req.user.id);
  const today = T.todayStr();

  if (code.startsWith('SMARTQ|')) code = code.split('|')[2] || '';   // QR text: SMARTQ|id|verifyCode
  let t = await prisma.token.findUnique({ where: { verifyCode: code }, include: INCLUDE });
  if (!t) {                                                          // maybe the officer typed a token number
    t = await prisma.token.findFirst({
      where: { tokenNumber: code.toUpperCase(), tokenDate: T.dateToDb(today), ...pairsWhere(pairs) },
      orderBy: { id: 'desc' }, include: INCLUDE
    });
  }
  if (!t) return res.json({ success: true, result: 'INVALID', message: 'No token found with this code.' });
  if (!canAccess(pairs, t.officeId, t.serviceId)) {
    return res.json({ success: true, result: 'NOT_PERMITTED', message: 'This token belongs to a service or office you are not assigned to.' });
  }

  const summary = tokenRow(t);
  const tokenDay = T.dbToStr(t.tokenDate);
  if (t.status === 'CANCELLED') return res.json({ success: true, result: 'CANCELLED', message: 'This token was cancelled by the citizen.', token: summary });
  if (t.status === 'EXPIRED' || tokenDay < today) return res.json({ success: true, result: 'EXPIRED', message: 'This token has expired.', token: summary });
  if (tokenDay > today) return res.json({ success: true, result: 'NOT_TODAY', message: `This token is for ${tokenDay}, not today.`, token: summary });
  if (['COMPLETED', 'SKIPPED'].includes(t.status)) {
    return res.json({ success: true, result: 'ALREADY_USED', message: `This token is already ${t.status.toLowerCase()}.`, token: summary });
  }

  await prisma.$transaction([
    prisma.token.update({ where: { id: t.id }, data: { isVerified: true, verifiedAt: new Date(), verifiedById: req.user.id } }),
    prisma.tokenHistory.create({ data: { tokenId: t.id, fromStatus: t.status, toStatus: t.status, changedById: req.user.id, note: 'Verified by officer' } })
  ]);
  await logActivity(req.user.id, 'TOKEN_VERIFIED', t.tokenNumber);
  res.json({ success: true, result: 'VALID', message: 'Token is valid and verified.', token: { ...summary, isVerified: true } });
});
