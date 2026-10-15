// Queue rules (used by citizen, officer, public display and admin):
//  * One queue = one office + one service + one date.
//  * Order inside a queue: queueTime (slot start, or booking time for virtual tokens), then token id.
//  * Only WAITING tokens count as "people ahead".
const prisma = require('../config/prisma');
const { dbToStr, todayStr, dateToDb } = require('./time');

// ---- average service time -------------------------------------------------
const avgCache = new Map(); // serviceId -> { at, value }
async function serviceAvgMinutes(service) {
  const hit = avgCache.get(service.id);
  if (hit && Date.now() - hit.at < 60000) return hit.value;

  const rows = await prisma.token.findMany({
    where: { serviceId: service.id, status: 'COMPLETED', servingAt: { not: null }, completedAt: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: 50,
    select: { servingAt: true, completedAt: true }
  });
  const mins = rows.map((r) => (r.completedAt - r.servingAt) / 60000).filter((m) => m > 0 && m < 240);
  let value = { minutes: service.avgMinutes, source: 'configured' };
  if (mins.length >= 5) {
    const avg = mins.reduce((a, b) => a + b, 0) / mins.length;
    if (avg >= 1) value = { minutes: Math.round(avg), source: 'recorded' }; // ignore unrealistic very short demo clicks
  }
  avgCache.set(service.id, { at: Date.now(), value });
  return value;
}

// ---- position / waiting time ----------------------------------------------
async function queueInfo(token, service) {
  const empty = { peopleAhead: null, position: null, estimatedWaitMinutes: null, estimateSource: null };
  if (token.status !== 'WAITING') return empty;

  const peopleAhead = await prisma.token.count({
    where: {
      officeId: token.officeId, serviceId: token.serviceId, tokenDate: token.tokenDate, status: 'WAITING',
      OR: [{ queueTime: { lt: token.queueTime } }, { queueTime: token.queueTime, id: { lt: token.id } }]
    }
  });
  const info = { peopleAhead, position: peopleAhead + 1, estimatedWaitMinutes: null, estimateSource: null };

  if (dbToStr(token.tokenDate) === todayStr()) {          // estimate only for today's queue
    const avg = await serviceAvgMinutes(service);
    info.estimatedWaitMinutes = peopleAhead * avg.minutes;
    info.estimateSource = avg.source;
  }
  return info;
}

// ---- which queues may an officer work on? ---------------------------------
// An officer is assigned to (office + department). Services of that department at that office are theirs.
async function officerScope(officerId) {
  const assignments = await prisma.officerAssignment.findMany({
    where: { officerId },
    include: { office: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } }
  });
  const pairs = [];
  for (const a of assignments) {
    const list = await prisma.officeService.findMany({
      where: { officeId: a.officeId, departmentId: a.departmentId },
      select: { serviceId: true }
    });
    list.forEach((o) => pairs.push({ officeId: a.officeId, serviceId: o.serviceId }));
  }
  return { assignments, pairs };
}
const pairsWhere = (pairs) => ({ OR: pairs.map((p) => ({ officeId: p.officeId, serviceId: p.serviceId })) });
const canAccess = (pairs, officeId, serviceId) => pairs.some((p) => p.officeId === officeId && p.serviceId === serviceId);

// ---- expire tokens from past dates ----------------------------------------
let lastExpire = 0;
async function expireOldTokens(force = false) {
  if (!force && Date.now() - lastExpire < 60000) return;
  lastExpire = Date.now();
  const { changeStatus } = require('./tokens'); // required here to avoid a circular import at load time
  const stale = await prisma.token.findMany({
    where: { tokenDate: { lt: dateToDb(todayStr()) }, status: { in: ['WAITING', 'CALLED', 'SERVING'] } },
    take: 500
  });
  for (const t of stale) {
    try {
      await prisma.$transaction((tx) => changeStatus(tx, t, 'EXPIRED', null, 'Expired: the token date has passed'));
    } catch (err) {
      if (!err.isOperational) console.error('expire error:', err.message);
    }
  }
}

module.exports = { serviceAvgMinutes, queueInfo, officerScope, pairsWhere, canAccess, expireOldTokens };
