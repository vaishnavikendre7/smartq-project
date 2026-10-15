// All API routes in one readable place. Every private route first runs "authenticate", then "authorize(role)".
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

const auth = require('../controllers/authController');
const pub = require('../controllers/publicController');
const tokens = require('../controllers/tokenController');
const apps = require('../controllers/applicationController');
const complaints = require('../controllers/complaintController');
const officer = require('../controllers/officerController');
const admin = require('../controllers/adminController');

// ---------- health ----------
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
router.get('/health', asyncHandler(async (req, res) => {
  const offices = await prisma.office.count();
  res.json({ success: true, message: 'SmartQ API and database are working', offices });
}));

// ---------- auth ----------
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', authenticate, auth.me);
router.patch('/auth/profile', authenticate, auth.updateProfile);
router.patch('/auth/password', authenticate, auth.changePassword);

// ---------- public (no login) ----------
router.get('/public/offices', pub.offices);
router.get('/public/offices/:id/services', pub.officeServices);
router.get('/public/display/:officeId', pub.display);

// ---------- citizen ----------
const citizen = [authenticate, authorize('CITIZEN')];
router.get('/citizen/checklist/:serviceId', citizen, tokens.getChecklist);
router.put('/citizen/checklist/:docId', citizen, tokens.setChecklist);
router.get('/citizen/slots', citizen, tokens.slots);
router.post('/citizen/tokens', citizen, tokens.create);
router.get('/citizen/tokens', citizen, tokens.myTokens);
router.get('/citizen/tokens/:id', citizen, tokens.tokenDetail);
router.patch('/citizen/tokens/:id/cancel', citizen, tokens.cancel);
router.post('/citizen/feedback', citizen, tokens.giveFeedback);
router.get('/citizen/feedback', citizen, tokens.myFeedback);
router.get('/citizen/notifications', citizen, tokens.notifications);
router.patch('/citizen/notifications/read-all', citizen, tokens.markAllRead);
router.patch('/citizen/notifications/:id/read', citizen, tokens.markRead);
router.post('/citizen/applications', citizen, apps.create);
router.get('/citizen/applications', citizen, apps.mine);
router.get('/citizen/applications/:id', citizen, apps.mineDetail);
router.post('/citizen/complaints', citizen, complaints.create);
router.get('/citizen/complaints', citizen, complaints.mine);
router.get('/citizen/complaints/:id', citizen, complaints.mineDetail);

// ---------- officer ----------
const off = [authenticate, authorize('OFFICER')];
router.get('/officer/me', off, officer.me);
router.get('/officer/queue', off, officer.queue);
router.post('/officer/queue/call-next', off, officer.callNext);
router.patch('/officer/tokens/:id/serving', off, officer.serving);
router.patch('/officer/tokens/:id/complete', off, officer.complete);
router.patch('/officer/tokens/:id/skip', off, officer.skip);
router.post('/officer/tokens/verify', off, officer.verify);
router.get('/officer/applications', off, apps.officerList);
router.get('/officer/applications/:id', off, apps.officerDetail);
router.patch('/officer/applications/:id/status', off, apps.officerUpdateStatus);

// ---------- complaints handled by staff (admin always, officer only if allowed) ----------
const staff = [authenticate, authorize('ADMIN', 'OFFICER')];
router.get('/staff/complaints', staff, complaints.staffList);
router.get('/staff/complaints/:id', staff, complaints.staffDetail);
router.post('/staff/complaints/:id/respond', staff, complaints.respond);

// ---------- admin ----------
const adm = [authenticate, authorize('ADMIN')];
router.get('/admin/analytics', adm, admin.analytics);
router.get('/admin/offices', adm, admin.listOffices);
router.post('/admin/offices', adm, admin.createOffice);
router.put('/admin/offices/:id', adm, admin.updateOffice);
router.patch('/admin/offices/:id/active', adm, admin.toggleOffice);
router.post('/admin/departments', adm, admin.createDepartment);
router.put('/admin/departments/:id', adm, admin.updateDepartment);
router.delete('/admin/departments/:id', adm, admin.deleteDepartment);
router.get('/admin/services', adm, admin.listServices);
router.post('/admin/services', adm, admin.createService);
router.put('/admin/services/:id', adm, admin.updateService);
router.patch('/admin/services/:id/active', adm, admin.toggleService);
router.post('/admin/services/:id/documents', adm, admin.addDocument);
router.delete('/admin/documents/:id', adm, admin.deleteDocument);
router.put('/admin/office-services', adm, admin.saveOfficeService);
router.delete('/admin/office-services/:id', adm, admin.deleteOfficeService);
router.get('/admin/officers', adm, admin.listOfficers);
router.post('/admin/officers', adm, admin.createOfficer);
router.patch('/admin/officers/:id', adm, admin.updateOfficer);
router.post('/admin/officers/:id/assignments', adm, admin.assignOfficer);
router.delete('/admin/assignments/:id', adm, admin.removeAssignment);
router.get('/admin/tokens', adm, admin.listTokens);
router.get('/admin/applications', adm, apps.adminList);
router.get('/admin/logs', adm, admin.logs);

module.exports = router;
