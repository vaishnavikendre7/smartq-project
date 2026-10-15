// When the queue moves, tell the citizens who are close to the front (saved once per token).
const prisma = require('../config/prisma');
const { notifyWhenAhead } = require('../config/env');
const { notify } = require('./notify');
const { dbToStr, todayStr } = require('./time');

async function notifyApproaching(officeId, serviceId, tokenDate) {
  if (dbToStr(tokenDate) !== todayStr()) return;
  const waiting = await prisma.token.findMany({
    where: { officeId, serviceId, tokenDate, status: 'WAITING' },
    orderBy: [{ queueTime: 'asc' }, { id: 'asc' }],
    take: notifyWhenAhead + 1,
    include: { service: { select: { name: true } } }
  });
  for (let i = 0; i < waiting.length; i += 1) {
    const t = waiting[i];
    const msg = i === 0
      ? `Token ${t.tokenNumber} (${t.service.name}): you are next. Please be ready at the office.`
      : `Token ${t.tokenNumber} (${t.service.name}): only ${i} ${i === 1 ? 'person is' : 'people are'} ahead of you. Please reach the office.`;
    await notify(t.userId, 'Your turn is near', msg, 'QUEUE', `near-${t.id}`);
  }
}

module.exports = { notifyApproaching };
