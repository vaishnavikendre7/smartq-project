// All dates in SmartQ use Indian Standard Time (IST, UTC+05:30).
// Dates are text like "2026-10-11" and times are text like "10:30".
const TZ = 'Asia/Kolkata';
const OFFSET = '+05:30';

const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

const nowHM = () =>
  new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const isValidDateStr = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const isValidHM = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const dateToDb = (s) => new Date(`${s}T00:00:00.000Z`);      // value stored in a DATE column
const dbToStr = (d) => d.toISOString().slice(0, 10);          // DATE column -> "YYYY-MM-DD"
const slotInstant = (dateStr, hm) => new Date(`${dateStr}T${hm}:00${OFFSET}`); // real moment in time

const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const hmToMin = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const minToHm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Appointment slots of an office, e.g. 10:00, 10:30 ... (last slot must finish before closing)
const generateSlots = (open, close, step) => {
  const slots = [];
  for (let m = hmToMin(open); m + step <= hmToMin(close); m += step) slots.push(minToHm(m));
  return slots;
};

const isOfficeOpenNow = (office) => {
  const now = hmToMin(nowHM());
  return now >= hmToMin(office.openTime) && now < hmToMin(office.closeTime);
};

module.exports = {
  TZ, todayStr, nowHM, isValidDateStr, isValidHM, dateToDb, dbToStr, slotInstant,
  addDays, hmToMin, minToHm, generateSlots, isOfficeOpenNow
};
