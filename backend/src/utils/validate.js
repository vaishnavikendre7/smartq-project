// Small input-checking helpers. Each one throws a 400 error with a clear message.
const AppError = require('./AppError');

const text = (value, label, min = 1, max = 255) => {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v.length < min) throw new AppError(`${label} is required${min > 1 ? ` (at least ${min} characters)` : ''}.`);
  if (v.length > max) throw new AppError(`${label} must be at most ${max} characters.`);
  return v;
};
const optionalText = (value, label, max = 255) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return text(value, label, 1, max);
};
const email = (value) => {
  const v = text(value, 'Email', 5, 150).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new AppError('Please enter a valid email address.');
  return v;
};
const phone = (value) => {
  const v = text(value, 'Phone', 10, 10);
  if (!/^[6-9]\d{9}$/.test(v)) throw new AppError('Phone must be a 10-digit Indian mobile number.');
  return v;
};
const password = (value) => {
  const v = typeof value === 'string' ? value : '';
  if (v.length < 8 || v.length > 72 || !/[A-Za-z]/.test(v) || !/\d/.test(v))
    throw new AppError('Password must be 8-72 characters and contain letters and numbers.');
  return v;
};
const int = (value, label, { min = 1, max = 1000000 } = {}) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError(`${label} must be a whole number between ${min} and ${max}.`);
  return n;
};
const id = (value, label = 'ID') => int(value, label, { min: 1 });
const oneOf = (value, list, label) => {
  if (!list.includes(value)) throw new AppError(`${label} must be one of: ${list.join(', ')}.`);
  return value;
};
const bool = (value) => value === true || value === 'true' || value === 1 || value === '1';

module.exports = { text, optionalText, email, phone, password, int, id, oneOf, bool };
