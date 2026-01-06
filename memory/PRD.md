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

### Backend (FastAPI + MongoDB)
- [x] User management (register, login, logout, session handling)
- [x] Starlink accounts CRUD
- [x] Billing records management
- [x] Support tickets system
- [x] Extenders/sub-routers management
- [x] Devices management with whitelist status
- [x] Dashboard statistics API
- [x] Search and filter functionality

### Frontend (React + Tailwind + Shadcn/UI)
- [x] Login/Register pages with Google OAuth
- [x] Dashboard with stats, upcoming payments, recent payments
- [x] Accounts list with search and filter
- [x] Account detail page with tabs (Devices, Extenders, Billing, Tickets)
- [x] Add/edit/delete functionality for all entities
- [x] Dark "Space Tech Control Room" theme
- [x] Responsive design for mobile

## Prioritized Backlog

### P0 (Critical) - DONE
- ✅ Authentication (JWT + Google OAuth)
- ✅ Account CRUD
- ✅ Billing management
- ✅ Support tickets
- ✅ Connectivity tracking

### P1 (High Priority) - Future
- [ ] Device blocking/whitelisting via router API (when API access available)
- [ ] Email notifications for payment reminders
- [ ] Export data to CSV/PDF
- [ ] Bulk account import

### P2 (Medium Priority) - Future
- [ ] Dashboard charts and graphs
- [ ] Payment history analytics
- [ ] Multi-user collaboration features
- [ ] Audit logs for account changes

## Tech Stack
- **Backend**: FastAPI, MongoDB, JWT, bcrypt
- **Frontend**: React, Tailwind CSS, Shadcn/UI
- **Auth**: JWT + Emergent Google OAuth

## API Endpoints
- `/api/auth/*` - Authentication
- `/api/accounts/*` - Account management
- `/api/accounts/{id}/billing/*` - Billing records
- `/api/accounts/{id}/tickets/*` - Support tickets
- `/api/accounts/{id}/extenders/*` - Extender management
- `/api/accounts/{id}/devices/*` - Device management
- `/api/dashboard/stats` - Dashboard statistics
