// Administrator features: offices, departments, services, officers, monitoring, analytics, logs.
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const v = require('../utils/validate');
const logActivity = require('../utils/log');
const { expireOldTokens } = require('../utils/queue');
const T = require('../utils/time');

const TOKEN_STATUSES = ['WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'SKIPPED', 'CANCELLED', 'EXPIRED'];

// ======================= OFFICES =======================
const officeData = (b) => {
  const openTime = b.openTime; const closeTime = b.closeTime;
  if (!T.isValidHM(openTime) || !T.isValidHM(closeTime)) throw new AppError('Opening and closing time must look like 10:00.');
  if (T.hmToMin(closeTime) <= T.hmToMin(openTime)) throw new AppError('Closing time must be after opening time.');
  const slotMinutes = v.int(b.slotMinutes, 'Slot length (minutes)', { min: 5, max: 120 });
  if ((T.hmToMin(closeTime) - T.hmToMin(openTime)) < slotMinutes) throw new AppError('Slot length is longer than the working day.');
  return {
    name: v.text(b.name, 'Office name', 3, 150),
    address: v.text(b.address, 'Address', 5, 255),
    phone: v.optionalText(b.phone, 'Phone', 20),
    openTime, closeTime, slotMinutes,
    slotCapacity: v.int(b.slotCapacity, 'People per slot', { min: 1, max: 100 }),
    dailyTokenLimit: v.int(b.dailyTokenLimit, 'Daily token limit', { min: 1, max: 5000 })
  };
};

// GET /api/admin/offices
exports.listOffices = asyncHandler(async (req, res) => {
  const offices = await prisma.office.findMany({
    orderBy: { name: 'asc' },
    include: {
      departments: { orderBy: { name: 'asc' } },
      officeServices: { include: { service: true, department: true }, orderBy: { service: { name: 'asc' } } }
    }
  });
  res.json({ success: true, offices });
});

// POST /api/admin/offices
exports.createOffice = asyncHandler(async (req, res) => {
  const office = await prisma.office.create({ data: officeData(req.body) });
  await logActivity(req.user.id, 'OFFICE_CREATED', office.name);
  res.status(201).json({ success: true, office });
});

// PUT /api/admin/offices/:id
exports.updateOffice = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Office ID');
  const office = await prisma.office.update({ where: { id }, data: officeData(req.body) });
  await logActivity(req.user.id, 'OFFICE_UPDATED', office.name);
  res.json({ success: true, office });
});

// PATCH /api/admin/offices/:id/active   body: { isActive }
exports.toggleOffice = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Office ID');
  const office = await prisma.office.update({ where: { id }, data: { isActive: v.bool(req.body.isActive) } });
  await logActivity(req.user.id, office.isActive ? 'OFFICE_ACTIVATED' : 'OFFICE_DEACTIVATED', office.name);
  res.json({ success: true, office });
});

// ======================= DEPARTMENTS =======================
// POST /api/admin/departments   body: { officeId, name }
exports.createDepartment = asyncHandler(async (req, res) => {
  const officeId = v.id(req.body.officeId, 'Office');
  const d = await prisma.department.create({ data: { officeId, name: v.text(req.body.name, 'Department name', 2, 120) } });
  await logActivity(req.user.id, 'DEPARTMENT_CREATED', d.name);
  res.status(201).json({ success: true, department: d });
});
// PUT /api/admin/departments/:id
exports.updateDepartment = asyncHandler(async (req, res) => {
  const d = await prisma.department.update({
    where: { id: v.id(req.params.id, 'Department ID') }, data: { name: v.text(req.body.name, 'Department name', 2, 120) }
  });
  res.json({ success: true, department: d });
});
// DELETE /api/admin/departments/:id  (only when nobody uses it)
exports.deleteDepartment = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Department ID');
  const used = (await prisma.officeService.count({ where: { departmentId: id } })) + (await prisma.officerAssignment.count({ where: { departmentId: id } }));
  if (used) throw new AppError('This department is used by services or officers. Remove those links first.', 409);
  await prisma.department.delete({ where: { id } });
  res.json({ success: true });
});

// ======================= SERVICES & CHECKLISTS =======================
const serviceData = (b) => ({
  name: v.text(b.name, 'Service name', 3, 120),
  code: (() => {
    const c = v.text(b.code, 'Service code', 2, 5).toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(c)) throw new AppError('Service code must be 2-5 letters, e.g. INC.');
    return c;
  })(),
  description: v.optionalText(b.description, 'Description', 2000),
  avgMinutes: v.int(b.avgMinutes, 'Average minutes per person', { min: 1, max: 240 })
});

// GET /api/admin/services
exports.listServices = asyncHandler(async (req, res) => {
  const services = await prisma.service.findMany({ orderBy: { name: 'asc' }, include: { documents: { orderBy: { id: 'asc' } } } });
  res.json({ success: true, services });
});
// POST /api/admin/services
exports.createService = asyncHandler(async (req, res) => {
  const s = await prisma.service.create({ data: serviceData(req.body) });
  await logActivity(req.user.id, 'SERVICE_CREATED', s.name);
  res.status(201).json({ success: true, service: s });
});
// PUT /api/admin/services/:id
exports.updateService = asyncHandler(async (req, res) => {
  const s = await prisma.service.update({ where: { id: v.id(req.params.id, 'Service ID') }, data: serviceData(req.body) });
  await logActivity(req.user.id, 'SERVICE_UPDATED', s.name);
  res.json({ success: true, service: s });
});
// PATCH /api/admin/services/:id/active
exports.toggleService = asyncHandler(async (req, res) => {
  const s = await prisma.service.update({ where: { id: v.id(req.params.id, 'Service ID') }, data: { isActive: v.bool(req.body.isActive) } });
  await logActivity(req.user.id, s.isActive ? 'SERVICE_ACTIVATED' : 'SERVICE_DEACTIVATED', s.name);
  res.json({ success: true, service: s });
});
// POST /api/admin/services/:id/documents   body: { name }
exports.addDocument = asyncHandler(async (req, res) => {
  const serviceId = v.id(req.params.id, 'Service ID');
  const d = await prisma.requiredDocument.create({ data: { serviceId, name: v.text(req.body.name, 'Document name', 2, 150) } });
  res.status(201).json({ success: true, document: d });
});
// DELETE /api/admin/documents/:id
exports.deleteDocument = asyncHandler(async (req, res) => {
  await prisma.requiredDocument.delete({ where: { id: v.id(req.params.id, 'Document ID') } });
  res.json({ success: true });
});

// ======================= OFFICE <-> SERVICE =======================
// PUT /api/admin/office-services   body: { officeId, serviceId, departmentId, isAvailable, dailyLimit }
exports.saveOfficeService = asyncHandler(async (req, res) => {
  const officeId = v.id(req.body.officeId, 'Office');
  const serviceId = v.id(req.body.serviceId, 'Service');
  const departmentId = v.id(req.body.departmentId, 'Department');
  const dep = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dep || dep.officeId !== officeId) throw new AppError('The department must belong to the same office.');
  const data = { departmentId, isAvailable: req.body.isAvailable === undefined ? true : v.bool(req.body.isAvailable), dailyLimit: v.int(req.body.dailyLimit, 'Daily limit', { min: 1, max: 5000 }) };
  const row = await prisma.officeService.upsert({
    where: { officeId_serviceId: { officeId, serviceId } }, create: { officeId, serviceId, ...data }, update: data
  });
  await logActivity(req.user.id, 'OFFICE_SERVICE_SAVED', `office ${officeId} / service ${serviceId}`);
  res.json({ success: true, officeService: row });
});
// DELETE /api/admin/office-services/:id
exports.deleteOfficeService = asyncHandler(async (req, res) => {
  await prisma.officeService.delete({ where: { id: v.id(req.params.id, 'ID') } });
  res.json({ success: true });
});

// ======================= OFFICERS =======================
const officerSelect = {
  id: true, name: true, email: true, phone: true, isActive: true, canHandleComplaints: true, createdAt: true,
  assignments: { include: { office: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } }
};
// GET /api/admin/officers
exports.listOfficers = asyncHandler(async (req, res) => {
  const officers = await prisma.user.findMany({ where: { role: 'OFFICER' }, orderBy: { name: 'asc' }, select: officerSelect });
  res.json({ success: true, officers });
});
// POST /api/admin/officers   (only admins create officer accounts)
exports.createOfficer = asyncHandler(async (req, res) => {
  const email = v.email(req.body.email);
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError('This email is already registered.', 409);
  const officer = await prisma.user.create({
    data: {
      name: v.text(req.body.name, 'Name', 2, 100), email, phone: v.phone(req.body.phone),
      passwordHash: await bcrypt.hash(v.password(req.body.password), 10),
      role: 'OFFICER', canHandleComplaints: v.bool(req.body.canHandleComplaints)
    },
    select: officerSelect
  });
  await logActivity(req.user.id, 'OFFICER_CREATED', email);
  res.status(201).json({ success: true, officer });
});
// PATCH /api/admin/officers/:id   body: { name, phone, isActive, canHandleComplaints, password? }
exports.updateOfficer = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Officer ID');
  const existing = await prisma.user.findFirst({ where: { id, role: 'OFFICER' } });
  if (!existing) throw new AppError('Officer not found.', 404);
  const data = {
    name: v.text(req.body.name, 'Name', 2, 100), phone: v.phone(req.body.phone),
    isActive: v.bool(req.body.isActive), canHandleComplaints: v.bool(req.body.canHandleComplaints)
  };
  if (req.body.password) data.passwordHash = await bcrypt.hash(v.password(req.body.password), 10);
  const officer = await prisma.user.update({ where: { id }, data, select: officerSelect });
  await logActivity(req.user.id, 'OFFICER_UPDATED', existing.email);
  res.json({ success: true, officer });
});
// POST /api/admin/officers/:id/assignments   body: { officeId, departmentId }
exports.assignOfficer = asyncHandler(async (req, res) => {
  const officerId = v.id(req.params.id, 'Officer ID');
  const officeId = v.id(req.body.officeId, 'Office');
  const departmentId = v.id(req.body.departmentId, 'Department');
  if (!(await prisma.user.findFirst({ where: { id: officerId, role: 'OFFICER' } }))) throw new AppError('Officer not found.', 404);
  const dep = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dep || dep.officeId !== officeId) throw new AppError('The department must belong to the selected office.');
  const a = await prisma.officerAssignment.create({ data: { officerId, officeId, departmentId } });
  await logActivity(req.user.id, 'OFFICER_ASSIGNED', `officer ${officerId} -> department ${departmentId}`);
  res.status(201).json({ success: true, assignment: a });
});
// DELETE /api/admin/assignments/:id
exports.removeAssignment = asyncHandler(async (req, res) => {
  await prisma.officerAssignment.delete({ where: { id: v.id(req.params.id, 'Assignment ID') } });
  await logActivity(req.user.id, 'OFFICER_UNASSIGNED', `assignment ${req.params.id}`);
  res.json({ success: true });
});

// ======================= MONITORING =======================
// GET /api/admin/tokens?date=&officeId=&serviceId=&status=
exports.listTokens = asyncHandler(async (req, res) => {
  await expireOldTokens();
  const where = {};
  where.tokenDate = T.dateToDb(req.query.date && T.isValidDateStr(req.query.date) ? req.query.date : T.todayStr());
  if (req.query.officeId) where.officeId = v.id(req.query.officeId, 'Office');
  if (req.query.serviceId) where.serviceId = v.id(req.query.serviceId, 'Service');
  if (req.query.status) where.status = v.oneOf(req.query.status, TOKEN_STATUSES, 'Status');
  const rows = await prisma.token.findMany({
    where, orderBy: [{ queueTime: 'asc' }, { id: 'asc' }], take: 500,
    include: { office: { select: { name: true } }, service: { select: { name: true } }, user: { select: { name: true, phone: true } }, appointment: true, handledBy: { select: { name: true } } }
  });
  res.json({
    success: true,
    tokens: rows.map((t) => ({
      id: t.id, tokenNumber: t.tokenNumber, status: t.status, office: t.office.name, service: t.service.name,
      citizen: t.user.name, citizenPhone: t.user.phone, slotTime: t.appointment ? t.appointment.slotTime : null,
      isVirtual: !t.appointment, isVerified: t.isVerified, officer: t.handledBy ? t.handledBy.name : null,
      createdAt: t.createdAt, calledAt: t.calledAt, completedAt: t.completedAt
    }))
  });
});

// GET /api/admin/logs?limit=100
exports.logs = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 300);
  const rows = await prisma.activityLog.findMany({ orderBy: { id: 'desc' }, take: limit, include: { user: { select: { name: true, role: true } } } });
  res.json({ success: true, logs: rows.map((l) => ({ id: l.id, action: l.action, details: l.details, createdAt: l.createdAt, user: l.user ? `${l.user.name} (${l.user.role})` : 'System' })) });
});

// ======================= ANALYTICS =======================
// GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&officeId=
// Everything is calculated from real database records.
exports.analytics = asyncHandler(async (req, res) => {
  await expireOldTokens();
  const today = T.todayStr();
  const from = req.query.from && T.isValidDateStr(req.query.from) ? req.query.from : T.addDays(today, -6);
  const to = req.query.to && T.isValidDateStr(req.query.to) ? req.query.to : today;
  if (from > to) throw new AppError('"From" date must be before "To" date.');
  if (T.addDays(from, 92) < to) throw new AppError('Please choose a range of at most 92 days.');

  const tokenWhere = { tokenDate: { gte: T.dateToDb(from), lte: T.dateToDb(to) } };
  if (req.query.officeId) tokenWhere.officeId = v.id(req.query.officeId, 'Office');

  const [citizens, officers, offices, services, pendingApplications, totalApplications] = await Promise.all([
    prisma.user.count({ where: { role: 'CITIZEN' } }),
    prisma.user.count({ where: { role: 'OFFICER' } }),
    prisma.office.count({ where: { isActive: true } }),
    prisma.service.count({ where: { isActive: true } }),
    prisma.application.count({ where: { status: { notIn: ['APPROVED', 'REJECTED'] } } }),
    prisma.application.count()
  ]);

  const tokens = await prisma.token.findMany({
    where: tokenWhere,
    select: { tokenDate: true, queueTime: true, createdAt: true, calledAt: true, status: true, serviceId: true }
  });

  const byStatus = {}; TOKEN_STATUSES.forEach((s) => { byStatus[s] = 0; });
  const perDay = {}; const perHour = {}; const perService = {};
  const waits = [];
  for (const t of tokens) {
    byStatus[t.status] += 1;
    const day = T.dbToStr(t.tokenDate);
    perDay[day] = (perDay[day] || 0) + 1;
    const hour = Number(t.queueTime.toLocaleTimeString('en-GB', { timeZone: T.TZ, hour: '2-digit', hourCycle: 'h23' }).slice(0, 2));
    perHour[hour] = (perHour[hour] || 0) + 1;
    perService[t.serviceId] = (perService[t.serviceId] || 0) + 1;
    if (t.calledAt) {                       // waiting time = from (slot start or booking time, whichever is later) to being called
      const start = Math.max(t.createdAt.getTime(), t.queueTime.getTime());
      const m = (t.calledAt.getTime() - start) / 60000;
      if (m >= 0) waits.push(m);
    }
  }
  const days = []; for (let d = from; d <= to; d = T.addDays(d, 1)) days.push({ date: d, tokens: perDay[d] || 0 });
  const names = await prisma.service.findMany({ select: { id: true, name: true } });
  const nameOf = Object.fromEntries(names.map((s) => [s.id, s.name]));
  const topServices = Object.entries(perService).map(([id, count]) => ({ service: nameOf[id], count })).sort((a, b) => b.count - a.count).slice(0, 8);
  const busyHours = Object.entries(perHour).map(([h, count]) => ({ hour: `${String(h).padStart(2, '0')}:00`, count })).sort((a, b) => a.hour.localeCompare(b.hour));
  const peak = [...busyHours].sort((a, b) => b.count - a.count)[0] || null;

  const complaintGroups = await prisma.complaint.groupBy({ by: ['status'], _count: { _all: true } });
  const complaints = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 }; complaintGroups.forEach((c) => { complaints[c.status] = c._count._all; });
  const appGroups = await prisma.application.groupBy({ by: ['status'], _count: { _all: true } });
  const applications = {}; appGroups.forEach((a) => { applications[a.status] = a._count._all; });
  const rating = await prisma.feedback.aggregate({ _avg: { rating: true }, _count: { _all: true } });

  res.json({
    success: true,
    range: { from, to },
    totals: {
      citizens, officers, offices, services, tokensGenerated: tokens.length, tokensCompleted: byStatus.COMPLETED,
      pendingApplications, totalApplications, openComplaints: complaints.OPEN + complaints.IN_PROGRESS
    },
    tokensByStatus: byStatus,
    tokensPerDay: days,
    averageWaitMinutes: waits.length ? Math.round((waits.reduce((a, b) => a + b, 0) / waits.length) * 10) / 10 : null,
    waitSamples: waits.length,
    busyHours, peakHour: peak,
    topServices,
    applications, complaints,
    feedback: { average: rating._avg.rating ? Math.round(rating._avg.rating * 10) / 10 : null, count: rating._count._all }
  });
});
