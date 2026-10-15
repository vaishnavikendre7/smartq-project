// SmartQ API test suite. Needs: backend running, database seeded (npm run db:seed).
// Run in a second terminal:  npm run test:api
// Tip: set ENFORCE_WORKING_HOURS=false in backend/.env so tests also pass outside office hours.
const BASE = process.env.API_URL || 'http://localhost:5000/api';
const RUN = Date.now().toString().slice(-7);
const DEMO_PW = process.env.TEST_DEMO_PASSWORD || 'Demo@12345';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@smartq.demo';
const ADMIN_PW = process.env.TEST_ADMIN_PASSWORD || 'Admin@12345';

let passed = 0; let failed = 0; const results = [];

// A tiny "browser": remembers the login cookie of one user
function actor() {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const found = set.find((c) => c.startsWith('smartq_token='));
    if (found) cookie = found.split(';')[0];
    let data = {}; try { data = await res.json(); } catch { /* no body */ }
    return { status: res.status, data };
  };
  return {
    get: (p) => call('GET', p), post: (p, b) => call('POST', p, b || {}),
    patch: (p, b) => call('PATCH', p, b || {}), put: (p, b) => call('PUT', p, b || {}), del: (p) => call('DELETE', p),
    clearCookie: () => { cookie = ''; }
  };
}

async function check(name, expected, fn) {
  try {
    const actual = await fn();
    const ok = actual === true;
    results.push({ name, expected, actual: ok ? 'as expected' : String(actual), pass: ok });
    if (ok) passed += 1; else failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      expected: ${expected}\n      actual:   ${actual}`}`);
  } catch (err) {
    failed += 1; results.push({ name, expected, actual: `error: ${err.message}`, pass: false });
    console.log(`FAIL  ${name}\n      error: ${err.message}`);
  }
}
const eq = (actual, expected) => (actual === expected ? true : `got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`);

const istDate = (plusDays = 0) => {
  const d = new Date(Date.now() + plusDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

async function newCitizen(label) {
  const a = actor();
  const r = await a.post('/auth/register', { name: `Test ${label}`, email: `t${RUN}${label}@test.in`, phone: '9876543210', password: 'Passw0rdTest' });
  if (r.status !== 201) throw new Error(`could not register ${label}: ${JSON.stringify(r.data)}`);
  return a;
}
async function login(email, password) {
  const a = actor(); const r = await a.post('/auth/login', { email, password });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(r.data)}`);
  return a;
}

(async () => {
  console.log(`SmartQ API tests against ${BASE}\n`);
  const health = await actor().get('/health');
  if (health.status !== 200) { console.log('Server/database not reachable. Start the backend first.'); process.exit(1); }

  const anon = actor();
  const c1 = await newCitizen('a'); const c2 = await newCitizen('b'); const c3 = await newCitizen('c');
  const officer1 = await login('officer1@smartq.demo', DEMO_PW);   // Tehsil office, complaints allowed
  const officer2 = await login('officer2@smartq.demo', DEMO_PW);   // Seva Kendra, complaints NOT allowed
  const admin = await login(ADMIN_EMAIL, ADMIN_PW);

  // ---------- 1. Registration and login ----------
  await check('Register: duplicate email rejected', 'HTTP 409', async () =>
    eq((await anon.post('/auth/register', { name: 'Dup', email: `t${RUN}a@test.in`, phone: '9876543210', password: 'Passw0rdTest' })).status, 409));
  await check('Register: weak password rejected', 'HTTP 400', async () =>
    eq((await anon.post('/auth/register', { name: 'Weak', email: `w${RUN}@test.in`, phone: '9876543210', password: 'abc' })).status, 400));
  await check('Register: invalid phone rejected', 'HTTP 400', async () =>
    eq((await anon.post('/auth/register', { name: 'Ph', email: `p${RUN}@test.in`, phone: '12345', password: 'Passw0rdTest' })).status, 400));
  await check('Register: sending role=ADMIN is ignored (always CITIZEN)', 'role CITIZEN', async () => {
    const a = actor(); const r = await a.post('/auth/register', { name: 'Sneaky', email: `s${RUN}@test.in`, phone: '9876543210', password: 'Passw0rdTest', role: 'ADMIN' });
    return eq(r.data.user && r.data.user.role, 'CITIZEN');
  });
  await check('Login: wrong password rejected', 'HTTP 401', async () =>
    eq((await actor().post('/auth/login', { email: `t${RUN}a@test.in`, password: 'WrongPass123' })).status, 401));
  await check('Login: correct password works and /auth/me returns the citizen', 'role CITIZEN', async () => {
    const a = await login(`t${RUN}a@test.in`, 'Passw0rdTest'); const me = await a.get('/auth/me');
    return eq(me.data.user && me.data.user.role, 'CITIZEN');
  });
  await check('Password is never returned by the API', 'no passwordHash', async () => {
    const me = await c1.get('/auth/me'); return JSON.stringify(me.data).includes('passwordHash') ? 'passwordHash leaked' : true;
  });

  // ---------- 2. Permissions ----------
  await check('No login -> 401 on private route', 'HTTP 401', async () => eq((await anon.get('/citizen/tokens')).status, 401));
  await check('Citizen cannot open admin API', 'HTTP 403', async () => eq((await c1.get('/admin/offices')).status, 403));
  await check('Citizen cannot open officer API', 'HTTP 403', async () => eq((await c1.get('/officer/queue')).status, 403));
  await check('Officer cannot open admin API', 'HTTP 403', async () => eq((await officer1.get('/admin/analytics')).status, 403));
  await check('Admin cannot book citizen tokens', 'HTTP 403', async () => eq((await admin.post('/citizen/tokens', { officeId: 1, serviceId: 1 })).status, 403));
  await check('Fake token in Authorization header rejected', 'HTTP 401', async () => {
    const res = await fetch(`${BASE}/auth/me`, { headers: { Authorization: 'Bearer abc.def.ghi' } }); return eq(res.status, 401);
  });

  // ---------- 3. Offices and services ----------
  const offices = (await anon.get('/public/offices')).data.offices || [];
  const tehsil = offices.find((o) => o.name.startsWith('Tehsil')); const seva = offices.find((o) => o.name.startsWith('Aaple')); const muni = offices.find((o) => o.name.startsWith('Municipal'));
  await check('Offices list contains the 3 demo offices', '3 demo offices', async () => eq(Boolean(tehsil && seva && muni), true));
  const tehsilServices = (await anon.get(`/public/offices/${tehsil.id}/services`)).data.services;
  const muniServices = (await anon.get(`/public/offices/${muni.id}/services`)).data.services;
  const inc = tehsilServices.find((s) => s.code === 'INC');
  await check('Tehsil office offers Income Certificate with a checklist', 'INC with documents', async () => eq(Boolean(inc && inc.documents.length > 0), true));
  await check('Municipal office does NOT list Income Certificate', 'not offered', async () => eq(muniServices.some((s) => s.code === 'INC'), false));
  await check('Booking a service the office does not offer is refused', 'HTTP 400', async () =>
    eq((await c1.post('/citizen/tokens', { officeId: muni.id, serviceId: inc.id })).status, 400));
  await check('Invalid office id rejected', 'HTTP 404 or 400', async () => { const s = (await anon.get('/public/offices/99999/services')).status; return s === 404 || s === 400 ? true : s; });

  // ---------- 4. Checklist ----------
  await check('Citizen can mark a checklist document as ready', 'isReady true', async () => {
    const docId = inc.documents[0].id; await c1.put(`/citizen/checklist/${docId}`, { isReady: true });
    const list = (await c1.get(`/citizen/checklist/${inc.id}`)).data.documents; return eq(list.find((d) => d.id === docId).isReady, true);
  });

  // ---------- 5. Token generation, numbering, queue position ----------
  let t1; let t2;
  await check('Citizen A gets a virtual token', 'token WAITING, number starts with INC-', async () => {
    const r = await c1.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id }); t1 = r.data.token;
    return r.status === 201 && t1.status === 'WAITING' && t1.tokenNumber.startsWith('INC-') ? true : `status ${r.status} ${JSON.stringify(r.data)}`;
  });
  await check('Citizen B gets the next number', 'number is larger than A', async () => {
    const r = await c2.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id }); t2 = r.data.token;
    return Number(t2.tokenNumber.split('-')[1]) === Number(t1.tokenNumber.split('-')[1]) + 1 ? true : `${t1.tokenNumber} then ${t2.tokenNumber}`;
  });
  await check('Duplicate active token for same service is blocked', 'HTTP 409', async () =>
    eq((await c1.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id })).status, 409));
  await check('Queue position: A is ahead of B', 'B has one more person ahead than A', async () => {
    const a = (await c1.get(`/citizen/tokens/${t1.id}`)).data.token; const b = (await c2.get(`/citizen/tokens/${t2.id}`)).data.token;
    return eq(b.peopleAhead - a.peopleAhead, 1);
  });
  await check('Waiting time = people ahead x service minutes (only when calculable)', 'estimate matches', async () => {
    const b = (await c2.get(`/citizen/tokens/${t2.id}`)).data.token; return eq(b.estimatedWaitMinutes, b.peopleAhead * 10);
  });
  await check('Citizen cannot see another citizen\'s token', 'HTTP 404', async () => eq((await c3.get(`/citizen/tokens/${t1.id}`)).status, 404));
  await check('Citizen cannot cancel another citizen\'s token', 'HTTP 404', async () => eq((await c3.patch(`/citizen/tokens/${t1.id}/cancel`)).status, 404));

  // ---------- 6. Simultaneous requests ----------
  await check('8 citizens ask for tokens at the same moment -> 8 unique numbers', '8 different numbers', async () => {
    const people = []; for (let i = 0; i < 8; i += 1) people.push(await newCitizen(`par${i}`));
    const rs = await Promise.all(people.map((p) => p.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id })));
    const bad = rs.filter((r) => r.status !== 201);
    if (bad.length) return `failed requests: ${bad.map((b) => b.status + ' ' + (b.data.message || '')).join('; ')}`;
    const nums = rs.map((r) => r.data.token.tokenNumber);
    return new Set(nums).size === 8 ? true : `duplicates: ${nums.join(',')}`;
  });

  // ---------- 7. Officer queue ----------
  await check('Officer sees today\'s waiting queue for their own services only', 'queue has INC tokens, none from other offices', async () => {
    const q = (await officer1.get('/officer/queue')).data;
    return q.waiting.length >= 2 && q.waiting.every((w) => w.office.startsWith('Tehsil')) ? true : JSON.stringify(q.waiting.map((w) => w.office));
  });
  await check('Officer of ANOTHER office cannot see Tehsil tokens', 'none from Tehsil', async () => {
    const q = (await officer2.get('/officer/queue')).data; return eq(q.waiting.some((w) => w.office.startsWith('Tehsil')), false);
  });
  let called;
  await check('Call Next calls the OLDEST waiting token', 'status CALLED, lowest number', async () => {
    const r = await officer1.post('/officer/queue/call-next'); called = r.data.token;
    const q = (await officer1.get('/officer/queue')).data;
    const lowestLeft = Math.min(...q.waiting.map((w) => Number(w.tokenNumber.split('-')[1])));
    return r.status === 200 && called.status === 'CALLED' && Number(called.tokenNumber.split('-')[1]) < lowestLeft ? true : `status ${r.status}, called ${called && called.tokenNumber}`;
  });
  await check('Citizen is notified when called', 'notification "It is your turn!"', async () => {
    const owner = called.tokenNumber === t1.tokenNumber ? c1 : null; if (!owner) return true;
    const n = (await owner.get('/citizen/notifications')).data.notifications; return eq(n.some((x) => x.title === 'It is your turn!'), true);
  });
  await check('Cannot call another token while one is open', 'HTTP 409', async () => eq((await officer1.post('/officer/queue/call-next')).status, 409));
  await check('Cannot complete before Serving', 'HTTP 409', async () => eq((await officer1.patch(`/officer/tokens/${called.id}/complete`)).status, 409));
  await check('Other officer cannot change this token', 'HTTP 404 or 403', async () => { const s = (await officer2.patch(`/officer/tokens/${called.id}/serving`)).status; return s === 404 || s === 403 ? true : s; });
  await check('Mark Serving works', 'status SERVING', async () => eq((await officer1.patch(`/officer/tokens/${called.id}/serving`)).data.token.status, 'SERVING'));
  await check('Cannot skip a token that is already being served', 'HTTP 409', async () => eq((await officer1.patch(`/officer/tokens/${called.id}/skip`)).status, 409));

  // application is independent of token status
  const calledOwner = called.tokenNumber === t1.tokenNumber ? c1 : c2;
  let application;
  await check('Citizen submits a document application and gets an Application ID', 'ID like SQ2026000001', async () => {
    const r = await calledOwner.post('/citizen/applications', { officeId: tehsil.id, serviceId: inc.id, details: 'Name: Test Citizen. Purpose: scholarship. Annual income 150000.' });
    application = r.data.application; return r.status === 201 && /^SQ\d{4}\d{6}$/.test(application.applicationCode) ? true : `${r.status} ${JSON.stringify(r.data)}`;
  });
  await check('A second open application for the same service is blocked', 'HTTP 409', async () =>
    eq((await calledOwner.post('/citizen/applications', { officeId: tehsil.id, serviceId: inc.id, details: 'Duplicate application attempt' })).status, 409));
  await check('Mark Completed works', 'status COMPLETED', async () => eq((await officer1.patch(`/officer/tokens/${called.id}/complete`)).data.token.status, 'COMPLETED'));
  await check('Completing the visit does NOT approve the application', 'application still SUBMITTED', async () => {
    const a = (await calledOwner.get(`/citizen/applications/${application.id}`)).data.application; return eq(a.status, 'SUBMITTED');
  });
  await check('Token history records the changes', 'WAITING, CALLED, SERVING, COMPLETED', async () => {
    const h = (await calledOwner.get(`/citizen/tokens/${called.id}`)).data.history.map((x) => x.to).join(','); return eq(h, 'WAITING,CALLED,SERVING,COMPLETED');
  });
  await check('Completed token cannot be cancelled', 'HTTP 409', async () => eq((await calledOwner.patch(`/citizen/tokens/${called.id}/cancel`)).status, 409));

  // ---------- 8. Feedback ----------
  await check('Feedback is refused before the service is completed', 'HTTP 409', async () => {
    const other = called.tokenNumber === t1.tokenNumber ? c2 : c1; const tk = called.tokenNumber === t1.tokenNumber ? t2 : t1;
    return eq((await other.post('/citizen/feedback', { tokenId: tk.id, rating: 5 })).status, 409);
  });
  await check('Feedback after completion is saved; second one blocked', '201 then 409', async () => {
    const a = await calledOwner.post('/citizen/feedback', { tokenId: called.id, rating: 4, comment: 'Quick service' });
    const b = await calledOwner.post('/citizen/feedback', { tokenId: called.id, rating: 5 }); return a.status === 201 && b.status === 409 ? true : `${a.status}/${b.status}`;
  });
  await check('Feedback rating outside 1-5 rejected', 'HTTP 400', async () => eq((await calledOwner.post('/citizen/feedback', { tokenId: called.id, rating: 9 })).status, 400));

  // ---------- 9. Skip and cancel ----------
  await check('Skip flow: Call -> Skip; citizen told to take a new token', 'status SKIPPED', async () => {
    const r = await officer1.post('/officer/queue/call-next'); if (r.status !== 200) return `call-next ${r.status}`;
    const s = await officer1.patch(`/officer/tokens/${r.data.token.id}/skip`, { note: 'Not present' }); return eq(s.data.token.status, 'SKIPPED');
  });
  await check('Cancel: waiting token can be cancelled and leaves the queue', 'CANCELLED, others move up', async () => {
    const x = await newCitizen('cx'); const y = await newCitizen('cy');
    const tx = (await x.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id })).data.token;
    const ty = (await y.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id })).data.token;
    const before = (await y.get(`/citizen/tokens/${ty.id}`)).data.token.peopleAhead;
    const c = await x.patch(`/citizen/tokens/${tx.id}/cancel`);
    const after = (await y.get(`/citizen/tokens/${ty.id}`)).data.token.peopleAhead;
    return c.status === 200 && after === before - 1 ? true : `cancel ${c.status}, ahead ${before} -> ${after}`;
  });

  // ---------- 10. QR verification ----------
  await check('QR: valid token verifies (QR text and token number both work)', 'VALID', async () => {
    const z = await newCitizen('qr'); const tz = (await z.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id })).data.token;
    const byQr = await officer1.post('/officer/tokens/verify', { code: tz.qrValue });
    const byNo = await officer1.post('/officer/tokens/verify', { code: tz.tokenNumber });
    return byQr.data.result === 'VALID' && byNo.data.result === 'VALID' ? true : `${byQr.data.result}/${byNo.data.result}`;
  });
  await check('QR: nonsense code is INVALID', 'INVALID', async () => eq((await officer1.post('/officer/tokens/verify', { code: 'SMARTQ|1|doesnotexist' })).data.result, 'INVALID'));
  await check('QR: cancelled token is reported as CANCELLED', 'CANCELLED', async () => {
    const z = await newCitizen('qc'); const tz = (await z.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id })).data.token;
    await z.patch(`/citizen/tokens/${tz.id}/cancel`); return eq((await officer1.post('/officer/tokens/verify', { code: tz.qrValue })).data.result, 'CANCELLED');
  });
  await check('QR: officer of another office cannot verify the token', 'NOT_PERMITTED', async () => {
    const z = await newCitizen('qp'); const tz = (await z.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id })).data.token;
    return eq((await officer2.post('/officer/tokens/verify', { code: tz.qrValue })).data.result, 'NOT_PERMITTED');
  });
  await check('QR: citizens cannot verify tokens', 'HTTP 403', async () => eq((await c1.post('/officer/tokens/verify', { code: 'abc' })).status, 403));

  // ---------- 11. Appointments ----------
  const tomorrow = istDate(1);
  await check('Slots list: tomorrow has bookable slots with remaining capacity', 'slots available', async () => {
    const r = await c1.get(`/citizen/slots?officeId=${tehsil.id}&serviceId=${inc.id}&date=${tomorrow}`);
    return r.status === 200 && r.data.slots.length > 0 && r.data.slots[0].remaining === 3 ? true : JSON.stringify(r.data).slice(0, 200);
  });
  await check('Appointment booked for tomorrow 10:00', 'token for tomorrow with slot 10:00', async () => {
    const r = await c1.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id, date: tomorrow, slotTime: '10:00' });
    return r.status === 201 && r.data.token.slotTime === '10:00' && r.data.token.tokenDate === tomorrow ? true : `${r.status} ${JSON.stringify(r.data)}`;
  });
  await check('Slot overbooking is prevented (capacity 3)', '4th booking gets HTTP 409', async () => {
    const codes = [];
    for (const who of [c2, c3, await newCitizen('s4'), await newCitizen('s5')]) codes.push((await who.post('/citizen/tokens', { officeId: tehsil.id, serviceId: inc.id, date: tomorrow, slotTime: '10:00' })).status);
    return eq(codes.join(','), '201,201,409,409');
  });
  await check('Invalid slot time rejected', 'HTTP 400', async () => eq((await c1.post('/citizen/tokens', { officeId: tehsil.id, serviceId: 2, date: tomorrow, slotTime: '10:17' })).status, 400));
  await check('Booking too far ahead rejected', 'HTTP 400', async () => eq((await c1.post('/citizen/tokens', { officeId: tehsil.id, serviceId: 2, date: istDate(30), slotTime: '10:00' })).status, 400));
  await check('Booking in the past rejected', 'HTTP 400', async () => eq((await c1.post('/citizen/tokens', { officeId: tehsil.id, serviceId: 2, date: istDate(-1), slotTime: '10:00' })).status, 400));
  await check('QR: token for tomorrow is NOT_TODAY at the counter', 'NOT_TODAY', async () => {
    const tk = (await c1.get('/citizen/tokens')).data.current.find((x) => x.tokenDate === tomorrow);
    return eq((await officer1.post('/officer/tokens/verify', { code: tk.qrValue })).data.result, 'NOT_TODAY');
  });
  await check('Future appointment is NOT called today by Call Next', 'only today\'s tokens are called', async () => {
    const q = (await officer1.get('/officer/queue')).data; return eq(q.waiting.some((w) => w.tokenDate === tomorrow), false);
  });

  // ---------- 12. Application status flow ----------
  await check('Officer from another office cannot see the application', 'HTTP 404', async () => eq((await officer2.get(`/officer/applications/${application.id}`)).status, 404));
  await check('Officer sees the application with citizen details', 'details visible', async () => {
    const r = await officer1.get(`/officer/applications/${application.id}`); return eq(Boolean(r.data.application && r.data.application.details && r.data.application.citizen), true);
  });
  await check('Invalid jump SUBMITTED -> APPROVED is refused', 'HTTP 409', async () => eq((await officer1.patch(`/officer/applications/${application.id}/status`, { status: 'APPROVED' })).status, 409));
  await check('Rejecting without a reason is refused', 'HTTP 400', async () => eq((await officer1.patch(`/officer/applications/${application.id}/status`, { status: 'REJECTED' })).status, 400));
  await check('SUBMITTED -> DOCUMENTS_UNDER_VERIFICATION', 'HTTP 200', async () => eq((await officer1.patch(`/officer/applications/${application.id}/status`, { status: 'DOCUMENTS_UNDER_VERIFICATION' })).status, 200));
  await check('"Documents incomplete" needs a reason, then is saved', '400 then 200', async () => {
    const a = await officer1.patch(`/officer/applications/${application.id}/status`, { status: 'DOCUMENTS_UNDER_VERIFICATION' });
    const b = await officer1.patch(`/officer/applications/${application.id}/status`, { status: 'DOCUMENTS_UNDER_VERIFICATION', remark: 'Income proof is missing' });
    return a.status === 400 && b.status === 200 ? true : `${a.status}/${b.status}`;
  });
  await check('-> UNDER_REVIEW -> APPROVED', 'HTTP 200 both', async () => {
    const a = await officer1.patch(`/officer/applications/${application.id}/status`, { status: 'UNDER_REVIEW' });
    const b = await officer1.patch(`/officer/applications/${application.id}/status`, { status: 'APPROVED', remark: 'All documents verified' }); return a.status === 200 && b.status === 200 ? true : `${a.status}/${b.status}`;
  });
  await check('Approved application is final', 'HTTP 409', async () => eq((await officer1.patch(`/officer/applications/${application.id}/status`, { status: 'REJECTED', remark: 'changed my mind' })).status, 409));
  await check('Citizen sees the full timeline with remarks', 'at least 5 history rows, last = APPROVED', async () => {
    const a = (await calledOwner.get(`/citizen/applications/${application.id}`)).data.application;
    return a.history.length >= 5 && a.history[a.history.length - 1].status === 'APPROVED' && a.history.some((h) => h.remark === 'Income proof is missing') ? true : JSON.stringify(a.history.map((h) => h.status));
  });
  await check('Citizen gets an application-status notification', 'notification of type APPLICATION', async () => {
    const n = (await calledOwner.get('/citizen/notifications')).data; return eq(n.notifications.some((x) => x.type === 'APPLICATION' && x.message.includes(application.applicationCode)), true);
  });
  await check('Another citizen cannot read this application', 'HTTP 404', async () => eq((await c3.get(`/citizen/applications/${application.id}`)).status, 404));
  await check('Application with too-short details rejected', 'HTTP 400', async () => eq((await c3.post('/citizen/applications', { officeId: tehsil.id, serviceId: inc.id, details: 'short' })).status, 400));

  // ---------- 13. Notifications ----------
  await check('Mark all notifications as read', 'unread = 0', async () => {
    await calledOwner.patch('/citizen/notifications/read-all'); return eq((await calledOwner.get('/citizen/notifications')).data.unread, 0);
  });

  // ---------- 14. Complaints ----------
  let complaint;
  await check('Citizen files a complaint and gets a Complaint ID', 'ID like CMP2026000001', async () => {
    const r = await c1.post('/citizen/complaints', { officeId: tehsil.id, subject: 'Long waiting time', description: 'I waited a long time at the counter yesterday.' });
    complaint = r.data.complaint; return r.status === 201 && /^CMP\d{4}\d{6}$/.test(complaint.complaintCode) ? true : JSON.stringify(r.data);
  });
  await check('Officer WITHOUT complaint permission is blocked', 'HTTP 403', async () => eq((await officer2.get('/staff/complaints')).status, 403));
  await check('Officer WITH permission responds', 'HTTP 200', async () => eq((await officer1.post(`/staff/complaints/${complaint.id}/respond`, { message: 'We are looking into it.', status: 'IN_PROGRESS' })).status, 200));
  await check('Admin responds and resolves', 'HTTP 200', async () => eq((await admin.post(`/staff/complaints/${complaint.id}/respond`, { message: 'Issue resolved.', status: 'RESOLVED' })).status, 200));
  await check('Citizen sees status and both responses', 'RESOLVED with 2 responses', async () => {
    const c = (await c1.get(`/citizen/complaints/${complaint.id}`)).data.complaint; return c.status === 'RESOLVED' && c.responses.length === 2 ? true : JSON.stringify(c);
  });
  await check('Another citizen cannot read this complaint', 'HTTP 404', async () => eq((await c3.get(`/citizen/complaints/${complaint.id}`)).status, 404));

  // ---------- 15. Public display ----------
  await check('Public display screen needs no login and lists queues', 'queues array', async () => {
    const r = await anon.get(`/public/display/${tehsil.id}`); return eq(r.status === 200 && Array.isArray(r.data.queues) && r.data.queues.length > 0, true);
  });

  // ---------- 16. Admin management ----------
  let newOffice; let newService; let newDep; let newOfficer;
  await check('Admin creates an office', 'HTTP 201', async () => {
    const r = await admin.post('/admin/offices', { name: `Test Office ${RUN}`, address: '1 Test Road, Sample City', phone: '0240-0000000', openTime: '09:00', closeTime: '16:00', slotMinutes: 30, slotCapacity: 2, dailyTokenLimit: 50 });
    newOffice = r.data.office; return eq(r.status, 201);
  });
  await check('Office with closing time before opening is rejected', 'HTTP 400', async () =>
    eq((await admin.post('/admin/offices', { name: `Bad Office ${RUN}`, address: '1 Test Road', openTime: '17:00', closeTime: '09:00', slotMinutes: 30, slotCapacity: 2, dailyTokenLimit: 50 })).status, 400));
  await check('Admin creates a department, a service and a checklist item', '201 x3', async () => {
    const d = await admin.post('/admin/departments', { officeId: newOffice.id, name: 'Test Department' }); newDep = d.data.department;
    const s = await admin.post('/admin/services', { name: `Test Service ${RUN}`, code: 'TST', description: 'Demo service', avgMinutes: 5 }); newService = s.data.service;
    const doc = await admin.post(`/admin/services/${newService.id}/documents`, { name: 'Test document' });
    return [d.status, s.status, doc.status].join(',') === '201,201,201' ? true : [d.status, s.status, doc.status].join(',');
  });
  await check('Service code must be letters only', 'HTTP 400', async () => eq((await admin.post('/admin/services', { name: 'Bad Code Service', code: '12', avgMinutes: 5 })).status, 400));
  await check('Admin offers the service at the new office', 'HTTP 200', async () =>
    eq((await admin.put('/admin/office-services', { officeId: newOffice.id, serviceId: newService.id, departmentId: newDep.id, isAvailable: true, dailyLimit: 5 })).status, 200));
  await check('Admin cannot use a department from another office', 'HTTP 400', async () =>
    eq((await admin.put('/admin/office-services', { officeId: tehsil.id, serviceId: newService.id, departmentId: newDep.id, dailyLimit: 5 })).status, 400));
  await check('Admin creates an officer and assigns them', '201 and 201', async () => {
    const o = await admin.post('/admin/officers', { name: 'Test Officer', email: `off${RUN}@test.in`, phone: '9123456780', password: 'Officer@123', canHandleComplaints: false }); newOfficer = o.data.officer;
    const a = await admin.post(`/admin/officers/${newOfficer.id}/assignments`, { officeId: newOffice.id, departmentId: newDep.id }); return o.status === 201 && a.status === 201 ? true : `${o.status}/${a.status}`;
  });
  await check('New officer logs in and sees ONLY the new office queue scope', 'service TST only', async () => {
    const o = await login(`off${RUN}@test.in`, 'Officer@123'); const me = (await o.get('/officer/me')).data; return eq(me.services.map((s) => s.code).join(','), 'TST');
  });
  await check('Officer without assignments cannot call tokens', 'HTTP 403', async () => {
    const a = actor(); const o = await newCitizen('x'); void o; void a;
    const stranger = await login(`off${RUN}@test.in`, 'Officer@123'); const adminAssign = (await admin.get('/admin/officers')).data.officers.find((x) => x.id === newOfficer.id);
    await admin.del(`/admin/assignments/${adminAssign.assignments[0].id}`); const r = await stranger.post('/officer/queue/call-next'); return eq(r.status, 403);
  });
  await check('Daily limit per service is enforced (limit 5 -> 6th refused)', '5x201 then 409', async () => {
    const codes = []; for (let i = 0; i < 6; i += 1) { const p = await newCitizen(`lim${i}`); codes.push((await p.post('/citizen/tokens', { officeId: newOffice.id, serviceId: newService.id })).status); }
    return eq(codes.join(','), '201,201,201,201,201,409');
  });
  await check('Deactivated service cannot be booked', 'HTTP 400', async () => {
    await admin.patch(`/admin/services/${newService.id}/active`, { isActive: false });
    const p = await newCitizen('inact'); return eq((await p.post('/citizen/tokens', { officeId: newOffice.id, serviceId: newService.id })).status, 400);
  });
  await check('Deactivated office disappears from the public list', 'not listed', async () => {
    await admin.patch(`/admin/offices/${newOffice.id}/active`, { isActive: false });
    return eq(((await anon.get('/public/offices')).data.offices).some((o) => o.id === newOffice.id), false);
  });
  await check('Admin sees all tokens with filters', 'tokens listed', async () => {
    const r = await admin.get(`/admin/tokens?officeId=${tehsil.id}&status=WAITING`); return eq(r.status === 200 && r.data.tokens.every((t) => t.status === 'WAITING'), true);
  });
  await check('Admin sees all applications', 'list contains our application', async () => {
    const r = await admin.get('/admin/applications'); return eq(r.data.applications.some((a) => a.applicationCode === application.applicationCode), true);
  });
  await check('Admin analytics come from real records', 'tokensGenerated >= 15, completed >= 1', async () => {
    const r = (await admin.get(`/admin/analytics?from=${istDate(0)}&to=${istDate(7)}`)).data;
    return r.totals.tokensGenerated >= 15 && r.totals.tokensCompleted >= 1 && r.topServices.length > 0 ? true : JSON.stringify(r.totals);
  });
  await check('Analytics rejects a bad date range', 'HTTP 400', async () => eq((await admin.get('/admin/analytics?from=2026-10-10&to=2026-01-01')).status, 400));
  await check('Activity log records actions', 'logs exist', async () => eq(((await admin.get('/admin/logs')).data.logs || []).length > 5, true));

  // ---------- 17. Logout ----------
  await check('Logout clears the session', 'HTTP 401 afterwards', async () => {
    const a = await login(`t${RUN}a@test.in`, 'Passw0rdTest'); await a.post('/auth/logout'); a.clearCookie(); return eq((await a.get('/auth/me')).status, 401);
  });

  console.log(`\n${passed} passed, ${failed} failed (${passed + failed} checks)`);
  if (process.env.TEST_REPORT_JSON) require('fs').writeFileSync(process.env.TEST_REPORT_JSON, JSON.stringify(results, null, 2));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Test run crashed:', e); process.exit(1); });
