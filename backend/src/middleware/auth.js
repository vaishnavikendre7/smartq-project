// Checks who is logged in. The role ALWAYS comes from the database, never from the browser.
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { jwtSecret } = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, res, next) => {
  let token = req.cookies && req.cookies.smartq_token;           // normal: secure httpOnly cookie
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) token = header.slice(7); // Postman / testing
  if (!token) throw new AppError('Please log in to continue.', 401);

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    throw new AppError('Your session has expired. Please log in again.', 401);
  }
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || !user.isActive) throw new AppError('This account is not available.', 401);

  req.user = {
    id: user.id, name: user.name, email: user.email, role: user.role,
    canHandleComplaints: user.canHandleComplaints
  };
  next();
});

// authorize('ADMIN') or authorize('OFFICER', 'ADMIN')
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to do this.', 403));
  }
  next();
};

module.exports = { authenticate, authorize };
