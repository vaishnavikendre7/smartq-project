# SmartQ - Digital Queue Management and Government Document Application Tracking System

A full-stack college project. Citizens take virtual tokens or book appointment slots at government offices, follow the queue, read document checklists, submit document applications and track them on a timeline. Officers run the queue and update application statuses. Administrators manage everything and see analytics.

> **Important:** SmartQ is a college demonstration. The offices and addresses are sample data. It is **not** connected to any government system and cannot issue or approve real certificates. Approvals are made by demo officers inside this application only.

## 1. Technology

| Part | Technology |
|---|---|
| Frontend | React 19 + Vite 8, Tailwind CSS 4, Recharts (charts), qrcode.react (QR codes) |
| Backend | Node.js 22 (v22.22.3 LTS) + Express 4 |
| Database | MySQL 8, database name `my_app_db` |
| ORM | Prisma 6.19.3 (works with Node 22) |
| Security | JWT in an httpOnly cookie, bcrypt password hashing, role checks on the server |
| Updates | Simple polling every 10 seconds (no Socket.io) |

## 2. Features by role

**Citizen:** register/login, profile, choose an office then only the services it offers, read the document checklist and tick items as ready, take a virtual token or book a slot (up to 7 days ahead), see token number / date / queue position / estimated wait / QR code, cancel (rules below), token history, submit an application and get an Application ID, status timeline, in-app notifications (and email if configured), feedback after a completed visit, complaints with a Complaint ID and response history.

**Officer:** sees only their office and department queue, calls next, marks Serving / Completed / Skipped, verifies tokens by QR text or token number, reads application details and updates status (Submitted, Documents Under Verification, Under Review, Approved, Rejected) with reasons, daily statistics, answers complaints if the administrator allowed it.

**Administrator:** offices (hours, slot length, people per slot, daily limit, activate/deactivate), departments, services and checklists, which office offers which service, officer accounts and assignments, all tokens and applications with filters, complaints, analytics (cards and charts from real data, date filter), activity log.

**Public:** home, about, offices, services, and a live "Now Serving" display screen per office.

## 3. Queue rules (same in database, backend and frontend)

- A **queue = one office + one service + one date.** Each office has its own queues.
- **Token number** = service code + 3 digits, e.g. `INC-007`. The counter restarts each day for each office and service. Numbers come from the `TokenSequence` table inside a database transaction, so two citizens at the same moment never get the same number.
- **Order** in a queue: appointment slot time (or booking time for virtual tokens), then token id.
- **People ahead** = number of WAITING tokens before yours in the same queue. Cancelled, skipped, completed and expired tokens are not counted.
- **Estimated wait** = people ahead x average minutes per person. It is shown only for today's tokens. The average is the real average of the last completed services (when at least 5 exist and they are realistic), otherwise the minutes the administrator configured. For future dates no estimate is shown.
- **Officer scope:** an officer is assigned to (office + department) and works on every service of that department at that office. **Call Next** takes the oldest eligible WAITING token for today. An appointment token becomes eligible 30 minutes before its slot (`CALL_AHEAD_MINUTES`). An officer must finish (complete or skip) the current token before calling another one.
- **Status flow:** `WAITING -> CALLED -> SERVING -> COMPLETED`. `WAITING -> CANCELLED`, `CALLED -> SKIPPED`. Tokens from past dates become `EXPIRED` automatically.
- **Cancel:** only WAITING tokens. An appointment token cannot be cancelled within 30 minutes of its slot (`CANCEL_BEFORE_MINUTES`).
- **No duplicates:** one active token per citizen per service per date. Daily limits per office and per service, and a capacity per appointment slot, prevent overbooking.
- **Applications are separate from tokens.** Completing a visit never approves an application. Approved and Rejected are final. A reason is required to reject and to mark documents incomplete.

## 4. Setup on Windows (first time)

### 4.1 Install
1. **Node.js v22.22.3 LTS** (`node -v` must print `v22.22.3`, `npm -v` prints `10.9.8`).
2. **MySQL Server 8** and **MySQL Workbench**.
3. **VS Code**, and optionally **Postman**.

### 4.2 Database (MySQL Workbench)
Open a query tab on your local connection and run (skip if `my_app_db` already exists):
```sql
CREATE DATABASE IF NOT EXISTS my_app_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4.3 Backend
Open the project in VS Code and a terminal:
```bat
cd backend
npm install
copy .env.example .env
```
Open `backend\.env` and set:
- `DATABASE_URL` with your MySQL user and password, e.g. `mysql://root:YourPassword@localhost:3306/my_app_db` (if the password has `@` or `#`, write `%40` or `%23`).
- `JWT_SECRET` to any long random text (32+ characters).
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_PASSWORD` (used only by the seed script).

Then create the tables, add the data and start the server:
```bat
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```
The first Prisma command downloads its engine, so you need internet once. Your MySQL user needs permission to create databases (the `root` user has it) because Prisma uses a temporary "shadow" database for migrations.

Expected output: `MySQL connected (my_app_db)` and `SmartQ API running on http://localhost:5000`. Check `http://localhost:5000/api/health` in the browser: it shows `"offices":3`.

### 4.4 Frontend (second terminal)
```bat
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**. In development Vite forwards `/api` to port 5000, so no extra setting is needed.

### 4.5 Demo accounts (created by `npm run db:seed`)
| Role | Email | Password |
|---|---|---|
| Administrator | value of `ADMIN_EMAIL` (default `admin@smartq.demo`) | value of `ADMIN_PASSWORD` |
| Officer - Tehsil office (can answer complaints) | `officer1@smartq.demo` | `DEMO_PASSWORD` |
| Officer - Seva Kendra | `officer2@smartq.demo` | `DEMO_PASSWORD` |
| Officer - Municipal office (two departments, can answer complaints) | `officer3@smartq.demo` | `DEMO_PASSWORD` |
| Citizens | `citizen1@smartq.demo`, `citizen2@smartq.demo`, `citizen3@smartq.demo` | `DEMO_PASSWORD` |

### 4.6 How the first administrator is created (securely)
There is **no public admin registration**; the register form always creates a citizen and ignores any role you send. The first administrator is created only by the seed script using `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your private `.env`. After that, only an administrator can create officer accounts. Delete the seed passwords from `.env` after the first run and change demo passwords before any real use.

### 4.7 Quick demo flow (5 minutes)
1. Log in as `citizen1`, open **Book Token**, choose *Tehsil Office > Income Certificate*, tick the checklist, press **Get my token**. (If the office is closed at that hour, set `ENFORCE_WORKING_HOURS=false` in `.env` and restart the backend, or book a slot for tomorrow.)
2. In another browser window log in as `officer1`, press **Call next token**, then **Start serving**, then **Mark completed**.
3. The citizen's token page updates within 10 seconds (the status changes and a notification arrives).
4. As the citizen, submit an application for the same service. As the officer, open **Applications** and move it to Approved.
5. Log in as the administrator and open the dashboard.

## 5. Project structure
```
smartq/
|-- backend/
|   |-- prisma/            schema.prisma (all tables), seed.js (admin + demo data)
|   |-- src/
|   |   |-- config/        env.js, prisma.js
|   |   |-- middleware/    auth.js (login + roles), errorHandler.js
|   |   |-- utils/         queue rules, token rules, notifications, time helpers, validation
|   |   |-- controllers/   auth, public, token (citizen), application, complaint, officer, admin
|   |   |-- routes/        index.js (every API route)
|   |   |-- app.js, server.js
|   |-- tests/api.test.js  automated API tests
|   |-- .env.example
|-- frontend/
|   |-- src/ pages/(public, citizen, officer, admin, shared), components/, context/, hooks/, lib/, layouts/
|   |-- vite.config.js, .env.example
|-- docs/TEST_REPORT.md
|-- README.md
```

## 6. How the parts talk to each other
Browser (React page) -> `fetch('/api/...')` with the login cookie -> Express route -> middleware (`authenticate`, then `authorize('ROLE')`) -> controller -> Prisma -> MySQL -> JSON back to the page. The page asks again every 10 seconds (polling) to show queue changes.

## 7. API summary
All paths start with `/api`. "Role" is checked on the server for every private route.

| Method and path | Role | Purpose |
|---|---|---|
| POST `/auth/register`, `/auth/login`, `/auth/logout` | public | account and session |
| GET `/auth/me`; PATCH `/auth/profile`, `/auth/password` | any logged in | profile |
| GET `/public/offices`, `/public/offices/:id/services`, `/public/display/:officeId` | public | offices, services + checklists, live display |
| GET `/citizen/checklist/:serviceId`; PUT `/citizen/checklist/:docId` | citizen | document checklist ticks |
| GET `/citizen/slots?officeId&serviceId&date` | citizen | free appointment slots |
| POST `/citizen/tokens`; GET `/citizen/tokens`, `/citizen/tokens/:id`; PATCH `/citizen/tokens/:id/cancel` | citizen | create, list, detail (position, wait, QR), cancel |
| POST/GET `/citizen/applications`, GET `/citizen/applications/:id` | citizen | submit and track applications |
| GET `/citizen/notifications`; PATCH `.../:id/read`, `.../read-all` | citizen | notifications |
| POST/GET `/citizen/feedback` | citizen | ratings |
| POST/GET `/citizen/complaints`, GET `/citizen/complaints/:id` | citizen | complaints |
| GET `/officer/me`, `/officer/queue`; POST `/officer/queue/call-next` | officer | queue and call next |
| PATCH `/officer/tokens/:id/serving`, `/complete`, `/skip`; POST `/officer/tokens/verify` | officer | token processing and QR check |
| GET `/officer/applications`, `/officer/applications/:id`; PATCH `.../status` | officer | application handling |
| GET `/staff/complaints`, `/staff/complaints/:id`; POST `.../respond` | admin, or officer if allowed | complaint handling |
| `/admin/offices`, `/admin/departments`, `/admin/services`, `/admin/documents`, `/admin/office-services`, `/admin/officers`, `/admin/assignments` | admin | management (GET/POST/PUT/PATCH/DELETE) |
| GET `/admin/tokens`, `/admin/applications`, `/admin/analytics`, `/admin/logs` | admin | monitoring and reports |

Controllers: `backend/src/controllers/*.js`. Routes: `backend/src/routes/index.js`.

## 8. Security
bcrypt hashing; JWT in an `httpOnly`, `SameSite=Lax` cookie (JavaScript cannot read it); the role is read from the database on every request; every private route checks the role; citizens can only read their own tokens, applications and complaints; officers only work on their assigned services; all inputs are validated on the server; Prisma uses parameterised queries; errors never show passwords, SQL or stack traces; secrets are only in `.env` (which is git-ignored). In production set `NODE_ENV=production` (secure cookie) and serve over HTTPS.

## 9. Optional email notifications
In-app notifications always work. To also send email, fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `backend/.env` (for Gmail use an *App Password*, never your real password) and restart. If `SMTP_HOST` is empty nothing is sent. Email sending was not tested by the author.

## 10. Testing
Automated API tests (backend must be running, database seeded):
```bat
cd backend
npm run test:api
```
See `docs/TEST_REPORT.md` for the results, what was and was not tested, and a manual UI checklist.

## 11. Troubleshooting
| Problem | Fix |
|---|---|
| `Missing .env settings` | Create `backend/.env` from `.env.example`. |
| `Can't reach database server` / `Could not connect to MySQL` | Start MySQL (Windows Services -> MySQL80), check user, password and port in `DATABASE_URL`. |
| `Access denied` | Wrong MySQL user or password in `DATABASE_URL`. Encode special characters (`@` = `%40`). |
| `prisma migrate dev` says it cannot create the shadow database | Use a MySQL user with CREATE privilege (root), or run `npx prisma db push` instead. |
| `Table ... does not exist` | You skipped `npx prisma migrate dev --name init`. |
| `The office is closed now` when taking a token | Real behaviour. Book an appointment, or set `ENFORCE_WORKING_HOURS=false` for a demo. |
| Cookies/login not working when frontend and backend run on different addresses | Use the Vite dev server (it proxies `/api`), or set `CLIENT_ORIGIN` and `VITE_API_URL` and use HTTPS. |
| `'node' is not recognized` | Reopen the terminal after installing Node.js. |
| Port 5000 or 5173 in use | Change `PORT` in `backend/.env` and the proxy target in `frontend/vite.config.js`. |

## 12. Screenshots
Add your screenshots here: landing page, booking steps, token with QR, application timeline, officer queue, admin dashboard.

## 13. Limitations and future work
- Queue screens use polling (10 seconds), not instant push.
- QR codes are shown as images; the officer reads them with any scanner or phone app and pastes the text (or types the token number). There is no built-in camera scanner.
- Email is optional; there is no SMS.
- File upload of documents is not included (applications store text details only).
- The estimated wait is a simple average-based estimate.
- Future work: camera QR scanner, SMS/WhatsApp alerts, document uploads, multiple counters per office, Marathi/Hindi interface, real-time updates.
