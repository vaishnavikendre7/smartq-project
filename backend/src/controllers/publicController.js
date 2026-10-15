// Public information. No login needed.
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const v = require('../utils/validate');
const { todayStr, dateToDb, isOfficeOpenNow } = require('../utils/time');
const { expireOldTokens } = require('../utils/queue');

// GET /api/public/offices
exports.offices = asyncHandler(async (req, res) => {
  const list = await prisma.office.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { officeServices: { where: { isAvailable: true, service: { isActive: true } } } } } }
  });
  res.json({
    success: true,
    offices: list.map((o) => ({
      id: o.id, name: o.name, address: o.address, phone: o.phone,
      openTime: o.openTime, closeTime: o.closeTime, slotMinutes: o.slotMinutes,
      isOpenNow: isOfficeOpenNow(o), serviceCount: o._count.officeServices
    }))
  });
});

// GET /api/public/offices/:id/services  (only services this office really offers)
exports.officeServices = asyncHandler(async (req, res) => {
  const officeId = v.id(req.params.id, 'Office ID');
  const office = await prisma.office.findFirst({ where: { id: officeId, isActive: true } });
  if (!office) throw new AppError('Office not found.', 404);

  const rows = await prisma.officeService.findMany({
    where: { officeId, isAvailable: true, service: { isActive: true } },
    include: { service: { include: { documents: { orderBy: { id: 'asc' } } } }, department: true },
    orderBy: { service: { name: 'asc' } }
  });
  res.json({
    success: true,
    office: { id: office.id, name: office.name, address: office.address, openTime: office.openTime, closeTime: office.closeTime },
    services: rows.map((r) => ({
      id: r.service.id, name: r.service.name, code: r.service.code, description: r.service.description,
      avgMinutes: r.service.avgMinutes, department: r.department ? r.department.name : null,
      documents: r.service.documents.map((d) => ({ id: d.id, name: d.name }))
    }))
  });
});

// GET /api/public/display/:officeId  -> data for the big "Now Serving" screen
exports.display = asyncHandler(async (req, res) => {
  await expireOldTokens();
  const officeId = v.id(req.params.officeId, 'Office ID');
  const office = await prisma.office.findUnique({ where: { id: officeId } });
  if (!office || !office.isActive) throw new AppError('Office not found.', 404);

  const tokenDate = dateToDb(todayStr());
  const rows = await prisma.officeService.findMany({
    where: { officeId, isAvailable: true, service: { isActive: true } },
    include: { service: true }
  });
  const queues = [];
  for (const r of rows) {
    const nowServing = await prisma.token.findMany({
      where: { officeId, serviceId: r.serviceId, tokenDate, status: { in: ['CALLED', 'SERVING'] } },
      orderBy: { calledAt: 'asc' }, select: { tokenNumber: true, status: true }
    });
    const next = await prisma.token.findMany({
      where: { officeId, serviceId: r.serviceId, tokenDate, status: 'WAITING' },
      orderBy: [{ queueTime: 'asc' }, { id: 'asc' }], take: 5, select: { tokenNumber: true }
    });
    const waitingCount = await prisma.token.count({ where: { officeId, serviceId: r.serviceId, tokenDate, status: 'WAITING' } });
    queues.push({
      serviceId: r.serviceId, serviceName: r.service.name, nowServing, next: next.map((n) => n.tokenNumber), waitingCount
    });
  }
  res.json({
    success: true,
    office: { id: office.id, name: office.name, isOpenNow: isOfficeOpenNow(office) },
    updatedAt: new Date().toISOString(),
    queues
  });
});
