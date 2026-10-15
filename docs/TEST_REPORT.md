# SmartQ - Test Report

## How these tests were run

- **What was run:** the automated API suite in `backend/tests/api.test.js` (98 checks) against the real Express server and a real SQL database, including login cookies, roles, transactions and the seed data.
- **Environment used for this run:** Node 22.22, Prisma 6.19.3 (Rust-free client with the MariaDB adapter), **MariaDB 10.11**. My sandbox could not download Prisma's native MySQL engine, so the exact `MySQL 8 + native engine` combination was **not** run here. The SQL used is standard MySQL/MariaDB (`INSERT ... ON DUPLICATE KEY UPDATE`, normal Prisma queries).
- **Also run:** expiry of a back-dated token (see section 3), a production build of the frontend (`npm run build` succeeded), and a check that the Vite dev proxy forwards `/api` to the backend and that login sets an `HttpOnly; SameSite=Lax` cookie.
- **Not run (no browser in my environment):** visual/responsive checks of the React pages, and real email sending. Use the manual checklist in section 4 on your own computer and record your own results.
- **Re-run it yourself:** start the backend, then in a second terminal `cd backend && npm run test:api`. Set `ENFORCE_WORKING_HOURS=false` in `.env` first.

## 1. Automated API results: 98 passed, 0 failed

| # | Test case | Expected result | Actual result | Status |
|---|---|---|---|---|
| 1 | Register: duplicate email rejected | HTTP 409 | as expected | PASS |
| 2 | Register: weak password rejected | HTTP 400 | as expected | PASS |
| 3 | Register: invalid phone rejected | HTTP 400 | as expected | PASS |
| 4 | Register: sending role=ADMIN is ignored (always CITIZEN) | role CITIZEN | as expected | PASS |
| 5 | Login: wrong password rejected | HTTP 401 | as expected | PASS |
| 6 | Login: correct password works and /auth/me returns the citizen | role CITIZEN | as expected | PASS |
| 7 | Password is never returned by the API | no passwordHash | as expected | PASS |
| 8 | No login -> 401 on private route | HTTP 401 | as expected | PASS |
| 9 | Citizen cannot open admin API | HTTP 403 | as expected | PASS |
| 10 | Citizen cannot open officer API | HTTP 403 | as expected | PASS |
| 11 | Officer cannot open admin API | HTTP 403 | as expected | PASS |
| 12 | Admin cannot book citizen tokens | HTTP 403 | as expected | PASS |
| 13 | Fake token in Authorization header rejected | HTTP 401 | as expected | PASS |
| 14 | Offices list contains the 3 demo offices | 3 demo offices | as expected | PASS |
| 15 | Tehsil office offers Income Certificate with a checklist | INC with documents | as expected | PASS |
| 16 | Municipal office does NOT list Income Certificate | not offered | as expected | PASS |
| 17 | Booking a service the office does not offer is refused | HTTP 400 | as expected | PASS |
| 18 | Invalid office id rejected | HTTP 404 or 400 | as expected | PASS |
| 19 | Citizen can mark a checklist document as ready | isReady true | as expected | PASS |
| 20 | Citizen A gets a virtual token | token WAITING, number starts with INC- | as expected | PASS |
| 21 | Citizen B gets the next number | number is larger than A | as expected | PASS |
| 22 | Duplicate active token for same service is blocked | HTTP 409 | as expected | PASS |
| 23 | Queue position: A is ahead of B | B has one more person ahead than A | as expected | PASS |
| 24 | Waiting time = people ahead x service minutes (only when calculable) | estimate matches | as expected | PASS |
| 25 | Citizen cannot see another citizen's token | HTTP 404 | as expected | PASS |
| 26 | Citizen cannot cancel another citizen's token | HTTP 404 | as expected | PASS |
| 27 | 8 citizens ask for tokens at the same moment -> 8 unique numbers | 8 different numbers | as expected | PASS |
| 28 | Officer sees today's waiting queue for their own services only | queue has INC tokens, none from other offices | as expected | PASS |
| 29 | Officer of ANOTHER office cannot see Tehsil tokens | none from Tehsil | as expected | PASS |
| 30 | Call Next calls the OLDEST waiting token | status CALLED, lowest number | as expected | PASS |
| 31 | Citizen is notified when called | notification "It is your turn!" | as expected | PASS |
| 32 | Cannot call another token while one is open | HTTP 409 | as expected | PASS |
| 33 | Cannot complete before Serving | HTTP 409 | as expected | PASS |
| 34 | Other officer cannot change this token | HTTP 404 or 403 | as expected | PASS |
| 35 | Mark Serving works | status SERVING | as expected | PASS |
| 36 | Cannot skip a token that is already being served | HTTP 409 | as expected | PASS |
| 37 | Citizen submits a document application and gets an Application ID | ID like SQ2026000001 | as expected | PASS |
| 38 | A second open application for the same service is blocked | HTTP 409 | as expected | PASS |
| 39 | Mark Completed works | status COMPLETED | as expected | PASS |
| 40 | Completing the visit does NOT approve the application | application still SUBMITTED | as expected | PASS |
| 41 | Token history records the changes | WAITING, CALLED, SERVING, COMPLETED | as expected | PASS |
| 42 | Completed token cannot be cancelled | HTTP 409 | as expected | PASS |
| 43 | Feedback is refused before the service is completed | HTTP 409 | as expected | PASS |
| 44 | Feedback after completion is saved; second one blocked | 201 then 409 | as expected | PASS |
| 45 | Feedback rating outside 1-5 rejected | HTTP 400 | as expected | PASS |
| 46 | Skip flow: Call -> Skip; citizen told to take a new token | status SKIPPED | as expected | PASS |
| 47 | Cancel: waiting token can be cancelled and leaves the queue | CANCELLED, others move up | as expected | PASS |
| 48 | QR: valid token verifies (QR text and token number both work) | VALID | as expected | PASS |
| 49 | QR: nonsense code is INVALID | INVALID | as expected | PASS |
| 50 | QR: cancelled token is reported as CANCELLED | CANCELLED | as expected | PASS |
| 51 | QR: officer of another office cannot verify the token | NOT_PERMITTED | as expected | PASS |
| 52 | QR: citizens cannot verify tokens | HTTP 403 | as expected | PASS |
| 53 | Slots list: tomorrow has bookable slots with remaining capacity | slots available | as expected | PASS |
| 54 | Appointment booked for tomorrow 10:00 | token for tomorrow with slot 10:00 | as expected | PASS |
| 55 | Slot overbooking is prevented (capacity 3) | 4th booking gets HTTP 409 | as expected | PASS |
| 56 | Invalid slot time rejected | HTTP 400 | as expected | PASS |
| 57 | Booking too far ahead rejected | HTTP 400 | as expected | PASS |
| 58 | Booking in the past rejected | HTTP 400 | as expected | PASS |
| 59 | QR: token for tomorrow is NOT_TODAY at the counter | NOT_TODAY | as expected | PASS |
| 60 | Future appointment is NOT called today by Call Next | only today's tokens are called | as expected | PASS |
| 61 | Officer from another office cannot see the application | HTTP 404 | as expected | PASS |
| 62 | Officer sees the application with citizen details | details visible | as expected | PASS |
| 63 | Invalid jump SUBMITTED -> APPROVED is refused | HTTP 409 | as expected | PASS |
| 64 | Rejecting without a reason is refused | HTTP 400 | as expected | PASS |
| 65 | SUBMITTED -> DOCUMENTS_UNDER_VERIFICATION | HTTP 200 | as expected | PASS |
| 66 | "Documents incomplete" needs a reason, then is saved | 400 then 200 | as expected | PASS |
| 67 | -> UNDER_REVIEW -> APPROVED | HTTP 200 both | as expected | PASS |
| 68 | Approved application is final | HTTP 409 | as expected | PASS |
| 69 | Citizen sees the full timeline with remarks | at least 5 history rows, last = APPROVED | as expected | PASS |
| 70 | Citizen gets an application-status notification | notification of type APPLICATION | as expected | PASS |
| 71 | Another citizen cannot read this application | HTTP 404 | as expected | PASS |
| 72 | Application with too-short details rejected | HTTP 400 | as expected | PASS |
| 73 | Mark all notifications as read | unread = 0 | as expected | PASS |
| 74 | Citizen files a complaint and gets a Complaint ID | ID like CMP2026000001 | as expected | PASS |
| 75 | Officer WITHOUT complaint permission is blocked | HTTP 403 | as expected | PASS |
| 76 | Officer WITH permission responds | HTTP 200 | as expected | PASS |
| 77 | Admin responds and resolves | HTTP 200 | as expected | PASS |
| 78 | Citizen sees status and both responses | RESOLVED with 2 responses | as expected | PASS |
| 79 | Another citizen cannot read this complaint | HTTP 404 | as expected | PASS |
| 80 | Public display screen needs no login and lists queues | queues array | as expected | PASS |
| 81 | Admin creates an office | HTTP 201 | as expected | PASS |
| 82 | Office with closing time before opening is rejected | HTTP 400 | as expected | PASS |
| 83 | Admin creates a department, a service and a checklist item | 201 x3 | as expected | PASS |
| 84 | Service code must be letters only | HTTP 400 | as expected | PASS |
| 85 | Admin offers the service at the new office | HTTP 200 | as expected | PASS |
| 86 | Admin cannot use a department from another office | HTTP 400 | as expected | PASS |
| 87 | Admin creates an officer and assigns them | 201 and 201 | as expected | PASS |
| 88 | New officer logs in and sees ONLY the new office queue scope | service TST only | as expected | PASS |
| 89 | Officer without assignments cannot call tokens | HTTP 403 | as expected | PASS |
| 90 | Daily limit per service is enforced (limit 5 -> 6th refused) | 5x201 then 409 | as expected | PASS |
| 91 | Deactivated service cannot be booked | HTTP 400 | as expected | PASS |
| 92 | Deactivated office disappears from the public list | not listed | as expected | PASS |
| 93 | Admin sees all tokens with filters | tokens listed | as expected | PASS |
| 94 | Admin sees all applications | list contains our application | as expected | PASS |
| 95 | Admin analytics come from real records | tokensGenerated >= 15, completed >= 1 | as expected | PASS |
| 96 | Analytics rejects a bad date range | HTTP 400 | as expected | PASS |
| 97 | Activity log records actions | logs exist | as expected | PASS |
| 98 | Logout clears the session | HTTP 401 afterwards | as expected | PASS |

## 2. Mapping to the 15 scenarios in the project brief

| Scenario | Covered by |
|---|---|
| Registration, login, logout | Register/Login/Logout checks (1-7, last check) |
| Permissions per role | Permission checks (8-13) |
| Office/service listing, invalid office/service | Offices and services checks |
| Appointment booking, slots, overbooking | Appointment checks |
| Token generation and unique numbering | Token checks incl. 8 simultaneous requests |
| Queue position and waiting time | Queue position checks |
| Call next, Serving, Completed, Skipped | Officer queue checks |
| QR verification: valid, invalid, cancelled, wrong office, not today | QR checks; expired in section 3 |
| Application tracking, status history, reasons | Application checks |
| Application independent of token status | "Completing the visit does NOT approve the application" |
| Notifications | Notification checks |
| Feedback and complaints | Feedback and complaint checks |
| Admin management and analytics | Admin checks |
| Input validation and API errors | Validation checks throughout |
| Persistence after restart | Section 3 |

## 3. Extra checks run by hand

| Check | Expected | Actual | Status |
|---|---|---|---|
| Token dated 2 days ago while still WAITING, then the officer queue is opened | Status becomes EXPIRED and a history row "Expired: the token date has passed" is saved | Token 3 became EXPIRED and the history row was written | PASS |
| Stop and restart the API server and database, then read the data again | Users, tokens and applications are still there | Seed data and earlier test records were still present after the restarts (the sandbox stopped the database between steps) | PASS |
| `npm run build` in `frontend/` | Build completes | Built successfully | PASS |
| Vite dev server proxy: `GET /api/health` via port 5173 | Same JSON as the backend | `{"success":true,...}` returned | PASS |
| Login through the proxy | Cookie is HttpOnly and SameSite=Lax | `HttpOnly; SameSite=Lax` | PASS |

## 4. Manual UI checklist (for you to run and record)

| Test | Expected | Actual | Pass/Fail |
|---|---|---|---|
| Open every public page on a phone-width window (about 375 px) | No sideways scrolling; menu opens with the hamburger button | | |
| Citizen: book a virtual token, then watch the page for 10-20 seconds | Position changes after the officer calls a token | | |
| Citizen: QR code is shown on the token page | QR visible for Waiting/Called/Serving tokens | | |
| Officer: Call next, Start serving, Mark completed with confirmation dialogs | Dialogs appear for Skip and Complete | | |
| Admin: dashboard charts after some tokens exist | Charts show real numbers; date filter changes them | | |
| Log in as citizen and type `/admin` in the address bar | You are sent back to the citizen dashboard | | |
| Stop the backend and open any page | A clear "Cannot reach the server" message | | |
| Email: set SMTP values in `.env` and book a token | An email arrives (optional feature, untested by me) | | |
