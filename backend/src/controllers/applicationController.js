// Document applications. The application status is SEPARATE from the queue token status.
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const v = require('../utils/validate');
const logActivity = require('../utils/log');
const { notify } = require('../utils/notify');
const { todayStr } = require('../utils/time');
const { officerScope, pairsWhere, canAccess } = require('../utils/queue');

const STATUSES = ['SUBMITTED', 'DOCUMENTS_UNDER_VERIFICATION', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
// Allowed next statuses. Approved and Rejected are final.
const NEXT = {
  SUBMITTED: ['DOCUMENTS_UNDER_VERIFICATION', 'REJECTED'],
  DOCUMENTS_UNDER_VERIFICATION: ['DOCUMENTS_UNDER_VERIFICATION', 'UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: []
};
const LABEL = {
  SUBMITTED: 'Submitted', DOCUMENTS_UNDER_VERIFICATION: 'Documents Under Verification',
  UNDER_REVIEW: 'Under Review', APPROVED: 'Approved', REJECTED: 'Rejected'
};

const present = (a, extra = {}) => ({
  id: a.id, applicationCode: a.applicationCode, status: a.status, statusLabel: LABEL[a.status],
  remark: a.remark, createdAt: a.createdAt, updatedAt: a.updatedAt,
  office: a.office ? { id: a.office.id, name: a.office.name } : undefined,
  service: a.service ? { id: a.service.id, name: a.service.name } : undefined,
  nextStatuses: NEXT[a.status].map((s) => ({ value: s, label: LABEL[s] })),
  ...extra
});
const presentHistory = (h) => ({
  id: h.id, status: h.status, statusLabel: LABEL[h.status], remark: h.remark, at: h.createdAt,
  by: h.changedBy ? (h.changedBy.role === 'CITIZEN' ? 'You' : `${h.changedBy.name} (Officer)`) : 'System'
});

// ======================= CITIZEN =======================
// POST /api/citizen/applications   body: { officeId, serviceId, details }
exports.create = asyncHandler(async (req, res) => {
  const officeId = v.id(req.body.officeId, 'Office');
  const serviceId = v.id(req.body.serviceId, 'Service');
  const details = v.text(req.body.details, 'Application details', 10, 1500);

  const os = await prisma.officeService.findFirst({
    where: { officeId, serviceId, isAvailable: true, office: { isActive: true }, service: { isActive: true } },
    include: { office: true, service: true }
  });
  if (!os) throw new AppError('This service is not available at the selected office.', 400);

  const open = await prisma.application.findFirst({
    where: { userId: req.user.id, officeId, serviceId, status: { notIn: ['APPROVED', 'REJECTED'] } }
  });
  if (open) throw new AppError(`You already have an open application (${open.applicationCode}) for this service.`, 409);

  const app = await prisma.$transaction(async (tx) => {
    const a = await tx.application.create({
      data: { applicationCode: `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, userId: req.user.id, officeId, serviceId, details }
    });
    const code = `SQ${todayStr().slice(0, 4)}${String(a.id).padStart(6, '0')}`;
    await tx.applicationHistory.create({
      data: { applicationId: a.id, status: 'SUBMITTED', remark: 'Application submitted by citizen', changedById: req.user.id }
    });
    return tx.application.update({ where: { id: a.id }, data: { applicationCode: code } });
  });

  await logActivity(req.user.id, 'APPLICATION_SUBMITTED', app.applicationCode);
  await notify(req.user.id, 'Application submitted',
    `Your application ${app.applicationCode} for ${os.service.name} was submitted. Track it any time.`, 'APPLICATION');
  res.status(201).json({ success: true, application: present({ ...app, office: os.office, service: os.service }) });
});

// GET /api/citizen/applications
exports.mine = asyncHandler(async (req, res) => {
  const rows = await prisma.application.findMany({
    where: { userId: req.user.id }, orderBy: { id: 'desc' }, include: { office: true, service: true }
  });
  res.json({ success: true, applications: rows.map((a) => present(a)) });
});

// GET /api/citizen/applications/:id
exports.mineDetail = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Application ID');
  const a = await prisma.application.findFirst({
    where: { id, userId: req.user.id },
    include: { office: true, service: true, history: { orderBy: { id: 'asc' }, include: { changedBy: { select: { name: true, role: true } } } } }
  });
  if (!a) throw new AppError('Application not found.', 404);
  res.json({ success: true, application: present(a, { details: a.details, history: a.history.map(presentHistory) }) });
});

// ======================= OFFICER =======================
// GET /api/officer/applications?status=
exports.officerList = asyncHandler(async (req, res) => {
  const { pairs } = await officerScope(req.user.id);
  const where = { ...pairsWhere(pairs) };
  if (req.query.status) where.status = v.oneOf(req.query.status, STATUSES, 'Status');
  const rows = await prisma.application.findMany({
    where, orderBy: { id: 'desc' }, take: 200,
    include: { office: true, service: true, user: { select: { name: true, phone: true } } }
  });
  res.json({ success: true, applications: rows.map((a) => present(a, { citizen: a.user })) });
});

// GET /api/officer/applications/:id
exports.officerDetail = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Application ID');
  const { pairs } = await officerScope(req.user.id);
  const a = await prisma.application.findUnique({
    where: { id },
    include: {
      office: true, service: true, user: { select: { id: true, name: true, email: true, phone: true } },
      history: { orderBy: { id: 'asc' }, include: { changedBy: { select: { name: true, role: true } } } }
    }
  });
  if (!a || !canAccess(pairs, a.officeId, a.serviceId)) throw new AppError('Application not found in your assigned services.', 404);

  // The citizen's other applications, only for services this officer handles
  const others = await prisma.application.findMany({
    where: { userId: a.userId, id: { not: a.id }, ...pairsWhere(pairs) },
    orderBy: { id: 'desc' }, take: 10, include: { service: true }
  });
  res.json({
    success: true,
    application: present(a, {
      details: a.details, citizen: a.user, history: a.history.map(presentHistory),
      otherApplications: others.map((o) => ({ applicationCode: o.applicationCode, service: o.service.name, status: LABEL[o.status], createdAt: o.createdAt }))
    })
  });
});

// PATCH /api/officer/applications/:id/status   body: { status, remark }
exports.officerUpdateStatus = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Application ID');
  const status = v.oneOf(req.body.status, STATUSES, 'Status');
  const { pairs } = await officerScope(req.user.id);

  const a = await prisma.application.findUnique({ where: { id }, include: { service: true } });
  if (!a || !canAccess(pairs, a.officeId, a.serviceId)) throw new AppError('Application not found in your assigned services.', 404);
  if (!NEXT[a.status].includes(status)) {
    throw new AppError(`An application that is "${LABEL[a.status]}" cannot be changed to "${LABEL[status]}".`, 409);
  }
  // A reason is compulsory for Rejected and for "documents incomplete" (same status again)
  const needsReason = status === 'REJECTED' || status === a.status;
  const remark = needsReason ? v.text(req.body.remark, 'Reason', 5, 500) : v.optionalText(req.body.remark, 'Remark', 500);

  const updated = await prisma.$transaction(async (tx) => {
    // "where status = old status" blocks two officers changing it at the same time
    const r = await tx.application.updateMany({ where: { id, status: a.status }, data: { status, remark } });
    if (r.count !== 1) throw new AppError('This application was just updated by someone else. Please refresh.', 409);
    await tx.applicationHistory.create({ data: { applicationId: id, status, remark, changedById: req.user.id } });
    return tx.application.findUnique({ where: { id }, include: { office: true, service: true } });
  });

  await logActivity(req.user.id, 'APPLICATION_STATUS', `${a.applicationCode}: ${a.status} -> ${status}`);
  await notify(a.userId, 'Application update',
    `Application ${a.applicationCode} (${a.service.name}) is now "${LABEL[status]}".${remark ? ` Note: ${remark}` : ''}`,
    'APPLICATION');
  res.json({ success: true, application: present(updated) });
});

// ======================= ADMIN =======================
// GET /api/admin/applications?status=&officeId=&serviceId=
exports.adminList = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = v.oneOf(req.query.status, STATUSES, 'Status');
  if (req.query.officeId) where.officeId = v.id(req.query.officeId, 'Office');
  if (req.query.serviceId) where.serviceId = v.id(req.query.serviceId, 'Service');
  const rows = await prisma.application.findMany({
    where, orderBy: { id: 'desc' }, take: 300,
    include: { office: true, service: true, user: { select: { name: true, phone: true } } }
  });
  res.json({ success: true, applications: rows.map((a) => present(a, { citizen: a.user })) });
});

exports.STATUSES = STATUSES;
