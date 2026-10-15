const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const v = require('../utils/validate');
const logActivity = require('../utils/log');
const { notify } = require('../utils/notify');
const { todayStr } = require('../utils/time');

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
const present = (c, extra = {}) => ({
  id: c.id, complaintCode: c.complaintCode, subject: c.subject, status: c.status,
  createdAt: c.createdAt, updatedAt: c.updatedAt, office: c.office ? c.office.name : null, ...extra
});
const presentReply = (r) => ({
  id: r.id, message: r.message, at: r.createdAt,
  by: r.responder.role === 'ADMIN' ? 'Administrator' : `${r.responder.name} (Officer)`
});

// ================= CITIZEN =================
// POST /api/citizen/complaints   body: { officeId (optional), subject, description }
exports.create = asyncHandler(async (req, res) => {
  const subject = v.text(req.body.subject, 'Subject', 5, 150);
  const description = v.text(req.body.description, 'Description', 10, 2000);
  let officeId = null;
  if (req.body.officeId) {
    officeId = v.id(req.body.officeId, 'Office');
    if (!(await prisma.office.findUnique({ where: { id: officeId } }))) throw new AppError('Office not found.', 404);
  }
  const c = await prisma.$transaction(async (tx) => {
    const created = await tx.complaint.create({
      data: { complaintCode: `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, userId: req.user.id, officeId, subject, description }
    });
    return tx.complaint.update({
      where: { id: created.id },
      data: { complaintCode: `CMP${todayStr().slice(0, 4)}${String(created.id).padStart(6, '0')}` }
    });
  });
  await logActivity(req.user.id, 'COMPLAINT_CREATED', c.complaintCode);
  await notify(req.user.id, 'Complaint received', `Your complaint ${c.complaintCode} was registered.`, 'COMPLAINT');
  res.status(201).json({ success: true, complaint: present(c) });
});

// GET /api/citizen/complaints
exports.mine = asyncHandler(async (req, res) => {
  const rows = await prisma.complaint.findMany({ where: { userId: req.user.id }, orderBy: { id: 'desc' }, include: { office: true } });
  res.json({ success: true, complaints: rows.map((c) => present(c)) });
});

// GET /api/citizen/complaints/:id
exports.mineDetail = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Complaint ID');
  const c = await prisma.complaint.findFirst({
    where: { id, userId: req.user.id },
    include: { office: true, responses: { orderBy: { id: 'asc' }, include: { responder: { select: { name: true, role: true } } } } }
  });
  if (!c) throw new AppError('Complaint not found.', 404);
  res.json({ success: true, complaint: present(c, { description: c.description, responses: c.responses.map(presentReply) }) });
});

// ================= OFFICER (if allowed) + ADMIN =================
// Which complaints can this staff member see?
async function staffWhere(user) {
  if (user.role === 'ADMIN') return {};
  if (!user.canHandleComplaints) throw new AppError('Complaint handling is not enabled for your account.', 403);
  const assigns = await prisma.officerAssignment.findMany({ where: { officerId: user.id }, select: { officeId: true } });
  return { officeId: { in: [...new Set(assigns.map((a) => a.officeId))] } };
}

// GET /api/staff/complaints?status=
exports.staffList = asyncHandler(async (req, res) => {
  const where = await staffWhere(req.user);
  if (req.query.status) where.status = v.oneOf(req.query.status, STATUSES, 'Status');
  const rows = await prisma.complaint.findMany({
    where, orderBy: { id: 'desc' }, take: 200,
    include: { office: true, user: { select: { name: true } } }
  });
  res.json({ success: true, complaints: rows.map((c) => present(c, { citizen: c.user.name })) });
});

// GET /api/staff/complaints/:id
exports.staffDetail = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Complaint ID');
  const where = { ...(await staffWhere(req.user)), id };
  const c = await prisma.complaint.findFirst({
    where,
    include: {
      office: true, user: { select: { name: true, email: true, phone: true } },
      responses: { orderBy: { id: 'asc' }, include: { responder: { select: { name: true, role: true } } } }
    }
  });
  if (!c) throw new AppError('Complaint not found.', 404);
  res.json({ success: true, complaint: present(c, { description: c.description, citizen: c.user, responses: c.responses.map(presentReply) }) });
});

// POST /api/staff/complaints/:id/respond   body: { message, status }
exports.respond = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id, 'Complaint ID');
  const where = { ...(await staffWhere(req.user)), id };
  const c = await prisma.complaint.findFirst({ where });
  if (!c) throw new AppError('Complaint not found.', 404);
  const message = v.text(req.body.message, 'Response', 3, 1000);
  const status = v.oneOf(req.body.status || 'IN_PROGRESS', STATUSES, 'Status');

  await prisma.$transaction([
    prisma.complaintResponse.create({ data: { complaintId: id, responderId: req.user.id, message } }),
    prisma.complaint.update({ where: { id }, data: { status } })
  ]);
  await logActivity(req.user.id, 'COMPLAINT_RESPONSE', `${c.complaintCode} -> ${status}`);
  await notify(c.userId, 'Complaint update', `There is a new response on complaint ${c.complaintCode}. Status: ${status.replace('_', ' ')}.`, 'COMPLAINT');
  res.json({ success: true, message: 'Response saved.' });
});
