# Starlink Multi-Account Management App - PRD

## Original Problem Statement
Build a web application to manage multiple Starlink internet accounts with features for account management, billing tracking, support tickets, and connectivity monitoring.

## User Personas
- **Primary**: Account managers handling multiple Starlink installations for clients/locations
- **Secondary**: Individual users managing personal Starlink accounts

## Core Requirements
- Add/edit/delete Starlink accounts
- Store account metadata (name, location, email, kit number, devices, notes)
- Track billing cycles and record payments manually
- Payment reminders and upcoming payment alerts
- Support ticket management per account
- Connectivity tracking (online status, extenders, devices)
- Search and filter accounts
- Role-based access (admin, viewer)

## What's Been Implemented (December 2025)

### Authentication
- [x] JWT-based custom auth (email/password registration/login)
- [x] Google OAuth via Emergent Auth integration
- [x] Session persistence with React Context
- [x] Role-based access control (admin/viewer)
- [x] Password strength indicator (Weak/Medium/Strong/Very Strong)

### Backend (FastAPI + MongoDB)
- [x] User management with phone number support
- [x] Starlink accounts CRUD with status (active/inactive/cancelled)
- [x] Billing records with paid/pending status
- [x] Billing day support for 1-31 days with smart month handling
- [x] Support tickets system
- [x] Extenders/sub-routers management
- [x] Devices management with whitelist status
- [x] Dashboard statistics API
- [x] Search and filter functionality

### Notification System
- [x] In-app notifications with bell icon
- [x] Email notifications via Gmail SMTP (Nodemailer)
- [x] SMS notifications via Twilio
- [x] Payment reminders (5 days, 3 days, 1 day before)
- [x] Test Email/SMS buttons in Settings

### Frontend (React + Tailwind + Shadcn/UI)
- [x] Login/Register pages with Google OAuth
- [x] Password strength indicator
- [x] Phone number field in registration and settings
- [x] Dashboard with stats, upcoming payments, recent payments
- [x] Accounts list with search, filter by connection & status
- [x] Account detail page with tabs (Devices, Extenders, Billing, Tickets)
- [x] Account status editing (Active/Inactive/Cancelled)
- [x] Payment tracking with Paid/Pending toggle
- [x] Notification bell with unread count
- [x] Settings page with notification testing
- [x] Dark "Space Tech Control Room" theme
- [x] Responsive design for mobile

## Prioritized Backlog

### P0 (Critical) - DONE
- ✅ Authentication (JWT + Google OAuth)
- ✅ Account CRUD with status
- ✅ Billing management with paid/pending status
- ✅ Support tickets
- ✅ Connectivity tracking
- ✅ Payment reminders (email, SMS, in-app)

### P1 (High Priority) - Future
- [ ] Device blocking/whitelisting via router API (when API access available)
- [ ] Automated reminder cron job (currently manual trigger)
- [ ] Export data to CSV/PDF
- [ ] Bulk account import

### P2 (Medium Priority) - Future
- [ ] Dashboard charts and graphs
- [ ] Payment history analytics
- [ ] Multi-user collaboration features
- [ ] Audit logs for account changes

## Tech Stack (Updated January 2026)
- **Backend**: Node.js, Express, PostgreSQL (Neon), JWT, bcryptjs, Twilio, Nodemailer
- **Frontend**: React, Tailwind CSS, Shadcn/UI
- **Database**: PostgreSQL hosted on Neon (serverless)
- **Auth**: JWT + Emergent Google OAuth
- **Notifications**: Twilio SMS, Gmail SMTP, In-app

## API Endpoints
- `/api/auth/*` - Authentication + user phone management
- `/api/accounts/*` - Account management with status
- `/api/accounts/{id}/billing/*` - Billing with paid/pending status
- `/api/accounts/{id}/tickets/*` - Support tickets
- `/api/accounts/{id}/extenders/*` - Extender management
- `/api/accounts/{id}/devices/*` - Device management
- `/api/notifications/*` - In-app notifications
- `/api/reminders/*` - Test email/SMS, check reminders
- `/api/dashboard/stats` - Dashboard statistics

## Migration History
- **January 2026**: Migrated backend from FastAPI/MongoDB to Node.js/Express/PostgreSQL (Neon) per user request for Vercel deployment compatibility

## Test Results (January 2026)
- Backend: 100% (23/23 tests passed)
- Frontend: 100% working (all major flows tested)
