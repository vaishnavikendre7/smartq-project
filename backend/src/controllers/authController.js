const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { jwtSecret, jwtExpiresIn, nodeEnv } = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const v = require('../utils/validate');
const logActivity = require('../utils/log');

const cookieOptions = {
  httpOnly: true,                // JavaScript in the browser cannot read this cookie
  sameSite: 'lax',
  secure: nodeEnv === 'production',
  maxAge: 24 * 60 * 60 * 1000
};

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
  canHandleComplaints: u.canHandleComplaints, createdAt: u.createdAt
});

const startSession = (res, user) => {
  const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: jwtExpiresIn });
  res.cookie('smartq_token', token, cookieOptions);
};

// POST /api/auth/register  (public, always creates a CITIZEN)
exports.register = asyncHandler(async (req, res) => {
  const name = v.text(req.body.name, 'Name', 2, 100);
  const email = v.email(req.body.email);
  const phone = v.phone(req.body.phone);
  const password = v.password(req.body.password);

  if (await prisma.user.findUnique({ where: { email } })) throw new AppError('This email is already registered.', 409);
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, phone, passwordHash, role: 'CITIZEN' } });
  await logActivity(user.id, 'REGISTER', `Citizen registered: ${email}`);

  startSession(res, user);
  res.status(201).json({ success: true, user: publicUser(user) });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const email = v.email(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new AppError('Wrong email or password.', 401); // same message for both cases on purpose

  // The role chosen on the login page must match the role saved in the database
  const chosenRole = typeof req.body.role === 'string' ? req.body.role.toUpperCase() : '';
  if (!['CITIZEN', 'OFFICER', 'ADMIN'].includes(chosenRole)) throw new AppError('Please choose Citizen, Officer or Admin.', 400);
  if (chosenRole !== user.role) {
    throw new AppError(`This account is not a ${chosenRole.charAt(0) + chosenRole.slice(1).toLowerCase()} account. Please choose the correct role.`, 403);
  }

  await logActivity(user.id, 'LOGIN', `${user.role} logged in`);
  startSession(res, user);
  res.json({ success: true, user: publicUser(user) });
});

// POST /api/auth/logout
exports.logout = (req, res) => {
  res.clearCookie('smartq_token', { ...cookieOptions, maxAge: undefined });
  res.json({ success: true, message: 'Logged out.' });
};

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ success: true, user: publicUser(user) });
});

// PATCH /api/auth/profile  (name and phone only)
exports.updateProfile = asyncHandler(async (req, res) => {
  const name = v.text(req.body.name, 'Name', 2, 100);
  const phone = v.phone(req.body.phone);
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { name, phone } });
  res.json({ success: true, user: publicUser(user) });
});

// PATCH /api/auth/password
exports.changePassword = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const current = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!(await bcrypt.compare(current, user.passwordHash))) throw new AppError('Current password is wrong.', 400);
  const passwordHash = await bcrypt.hash(v.password(req.body.newPassword), 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await logActivity(user.id, 'PASSWORD_CHANGE', null);
  res.json({ success: true, message: 'Password changed.' });
});