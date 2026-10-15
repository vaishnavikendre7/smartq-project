// Creates the first administrator (from .env) and realistic DEMO data.
// Safe to run again: existing records are kept, missing ones are added.
// Run:  npm run db:seed
require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SERVICES = [
  { code: 'INC', name: 'Income Certificate', avg: 10, description: 'Certificate showing the annual income of the applicant family.',
    docs: ['Aadhaar card (copy)', 'Ration card (copy)', 'Self-declaration of income', 'Salary slip or income proof', 'Passport size photo'] },
  { code: 'CST', name: 'Caste Certificate', avg: 12, description: 'Certificate of caste for educational and official use.',
    docs: ['Aadhaar card (copy)', 'School leaving certificate', "Father's caste proof or old caste record", 'Passport size photo'] },
  { code: 'DOM', name: 'Domicile Certificate', avg: 10, description: 'Proof that the applicant lives in the state.',
    docs: ['Aadhaar card (copy)', 'School leaving certificate', 'Electricity bill or rent agreement', 'Passport size photo'] },
  { code: 'NCL', name: 'Non-Creamy Layer Certificate', avg: 12, description: 'Certificate for OBC applicants who are in the non-creamy layer.',
    docs: ['Aadhaar card (copy)', 'Caste certificate', 'Income certificate', 'Passport size photo'] },
  { code: 'EWS', name: 'EWS Certificate', avg: 10, description: 'Economically Weaker Section certificate.',
    docs: ['Aadhaar card (copy)', 'Income certificate', 'Property details declaration', 'Passport size photo'] },
  { code: 'OAA', name: 'Online Application Assistance', avg: 15, description: 'Help to fill an online government application form.',
    docs: ['Aadhaar card (copy)', 'Mobile number linked to Aadhaar', 'Documents needed for the application'] },
  { code: 'DSU', name: 'Document Scanning and Upload Assistance', avg: 8, description: 'Scanning of documents and uploading them to the portal.',
    docs: ['Original documents', 'Aadhaar card (copy)'] },
  { code: 'ASA', name: 'Application Submission Assistance', avg: 10, description: 'Final checking and submission of a prepared application.',
    docs: ['Filled application form', 'Scanned documents', 'Aadhaar card (copy)'] },
  { code: 'BRT', name: 'Birth Certificate', avg: 8, description: 'Official certificate of birth registration.',
    docs: ['Hospital birth record', 'Aadhaar cards of parents (copy)', 'Marriage certificate of parents (copy)'] },
  { code: 'DTH', name: 'Death Certificate', avg: 8, description: 'Official certificate of death registration.',
    docs: ['Hospital or doctor death report', 'Aadhaar card of the deceased (copy)', 'Aadhaar card of the applicant (copy)'] },
  { code: 'MRS', name: 'Municipal Record Extract', avg: 10, description: 'Extract of property or municipal records, where eligible.',
    docs: ['Property tax receipt', 'Aadhaar card (copy)', 'Application letter'] }
];

const OFFICES = [
  { name: 'Tehsil / Tahsildar Office (Demo)', address: 'Station Road, Sample City, Maharashtra (demo address)', phone: '0240-1000001',
    openTime: '10:00', closeTime: '17:00', slotMinutes: 30, slotCapacity: 3,
    departments: { 'Revenue Certificates': ['INC', 'CST', 'DOM', 'NCL', 'EWS'] } },
  { name: 'Aaple Sarkar Seva Kendra (Demo)', address: 'Main Market, Sample City, Maharashtra (demo address)', phone: '0240-1000002',
    openTime: '09:30', closeTime: '17:30', slotMinutes: 30, slotCapacity: 4,
    departments: { 'Citizen Assistance': ['OAA', 'DSU', 'ASA'] } },
  { name: 'Municipal Council Office (Demo)', address: 'Civil Lines, Sample City, Maharashtra (demo address)', phone: '0240-1000003',
    openTime: '10:00', closeTime: '17:00', slotMinutes: 20, slotCapacity: 3,
    departments: { 'Births and Deaths Registry': ['BRT', 'DTH'], 'Municipal Records': ['MRS'] } }
];

const OFFICERS = [
  { name: 'Ramesh Patil', email: 'officer1@smartq.demo', phone: '9000000001', complaints: true,
    works: [['Tehsil / Tahsildar Office (Demo)', 'Revenue Certificates']] },
  { name: 'Sunita Joshi', email: 'officer2@smartq.demo', phone: '9000000002', complaints: false,
    works: [['Aaple Sarkar Seva Kendra (Demo)', 'Citizen Assistance']] },
  { name: 'Anil Kale', email: 'officer3@smartq.demo', phone: '9000000003', complaints: true,
    works: [['Municipal Council Office (Demo)', 'Births and Deaths Registry'], ['Municipal Council Office (Demo)', 'Municipal Records']] }
];

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 8) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 characters) in backend/.env first.');
  if (!demoPassword || demoPassword.length < 8) throw new Error('Set DEMO_PASSWORD (min 8 characters) in backend/.env first.');

  // --- administrator (there is NO public admin registration) ---
  if (!(await prisma.user.findUnique({ where: { email: adminEmail } }))) {
    await prisma.user.create({
      data: { name: process.env.ADMIN_NAME || 'System Admin', email: adminEmail, phone: '9999999999',
        passwordHash: await bcrypt.hash(adminPassword, 10), role: 'ADMIN' }
    });
    console.log(`Admin created: ${adminEmail}`);
  } else console.log(`Admin already exists: ${adminEmail}`);

  // --- services + checklists ---
  const serviceId = {};
  for (const s of SERVICES) {
    const row = await prisma.service.upsert({
      where: { code: s.code }, update: {},
      create: { code: s.code, name: s.name, description: s.description, avgMinutes: s.avg }
    });
    serviceId[s.code] = row.id;
    if ((await prisma.requiredDocument.count({ where: { serviceId: row.id } })) === 0) {
      await prisma.requiredDocument.createMany({ data: s.docs.map((name) => ({ serviceId: row.id, name })) });
    }
  }

  // --- offices, departments, office-services ---
  const departmentId = {}; const officeId = {};
  for (const o of OFFICES) {
    const office = await prisma.office.upsert({
      where: { name: o.name }, update: {},
      create: { name: o.name, address: o.address, phone: o.phone, openTime: o.openTime, closeTime: o.closeTime, slotMinutes: o.slotMinutes, slotCapacity: o.slotCapacity }
    });
    officeId[o.name] = office.id;
    for (const [depName, codes] of Object.entries(o.departments)) {
      const dep = await prisma.department.upsert({
        where: { officeId_name: { officeId: office.id, name: depName } }, update: {}, create: { officeId: office.id, name: depName }
      });
      departmentId[`${o.name}|${depName}`] = dep.id;
      for (const code of codes) {
        await prisma.officeService.upsert({
          where: { officeId_serviceId: { officeId: office.id, serviceId: serviceId[code] } }, update: {},
          create: { officeId: office.id, serviceId: serviceId[code], departmentId: dep.id, dailyLimit: 100 }
        });
      }
    }
  }

  // --- demo officers ---
  const hash = await bcrypt.hash(demoPassword, 10);
  for (const of of OFFICERS) {
    const user = await prisma.user.upsert({
      where: { email: of.email }, update: {},
      create: { name: of.name, email: of.email, phone: of.phone, passwordHash: hash, role: 'OFFICER', canHandleComplaints: of.complaints }
    });
    for (const [officeName, depName] of of.works) {
      await prisma.officerAssignment.upsert({
        where: { officerId_officeId_departmentId: { officerId: user.id, officeId: officeId[officeName], departmentId: departmentId[`${officeName}|${depName}`] } },
        update: {}, create: { officerId: user.id, officeId: officeId[officeName], departmentId: departmentId[`${officeName}|${depName}`] }
      });
    }
  }

  // --- demo citizens ---
  for (const [name, email, phone] of [['Demo Citizen One', 'citizen1@smartq.demo', '9000000011'], ['Demo Citizen Two', 'citizen2@smartq.demo', '9000000012'], ['Demo Citizen Three', 'citizen3@smartq.demo', '9000000013']]) {
    await prisma.user.upsert({ where: { email }, update: {}, create: { name, email, phone, passwordHash: hash, role: 'CITIZEN' } });
  }

  console.log('Demo data ready: 3 offices, 11 services, 3 officers, 3 citizens.');
  console.log('Demo logins (password = DEMO_PASSWORD from .env): officer1/2/3@smartq.demo, citizen1/2/3@smartq.demo');
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
