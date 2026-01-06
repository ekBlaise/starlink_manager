# Starlink Manager - Vercel Deployment

A full-stack application to manage multiple Starlink internet accounts.

## Tech Stack
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: Node.js Serverless Functions (Vercel)
- **Database**: PostgreSQL (Neon)
- **Notifications**: Twilio SMS, Gmail SMTP

## Project Structure
```
├── api/                    # Vercel serverless functions
│   ├── lib/               # Shared utilities
│   ├── auth/              # Authentication endpoints
│   ├── accounts/          # Account management
│   ├── notifications/     # Notification system
│   ├── dashboard/         # Dashboard stats
│   └── reminders/         # Email/SMS reminders
├── frontend/              # React application
└── vercel.json            # Vercel configuration
```

## Deployment Steps

### 1. Push to GitHub
Create a new repository and push this code:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/starlink-manager.git
git push -u origin main
```

### 2. Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave as is)

### 3. Environment Variables
Add these environment variables in Vercel dashboard:

```
DATABASE_URL=postgresql://neondb_owner:npg_SBb5CpHUlG7K@ep-misty-resonance-a4osa3s6-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-secure-jwt-secret-change-this
SMTP_EMAIL=g2melodycmr@gmail.com
SMTP_PASSWORD=fryp mvnb quyw snjk
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
TWILIO_ACCOUNT_SID=AC8c5634cb9b94fa5e8e0c2352a109c5fc
TWILIO_AUTH_TOKEN=40271969bdc5374b8cba7ee9f4c35834
TWILIO_PHONE_NUMBER=+19285979994
```

### 4. Deploy
Click "Deploy" and Vercel will:
- Install dependencies
- Build the React frontend
- Deploy serverless API functions

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update profile

### Accounts
- `GET /api/accounts` - List accounts
- `POST /api/accounts` - Create account
- `GET /api/accounts/:id` - Get account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

### Billing & Tickets
- `GET/POST /api/accounts/:id/billing` - Billing records
- `GET/POST /api/accounts/:id/tickets` - Support tickets

### Dashboard & Notifications
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/notifications` - User notifications
- `GET /api/notifications/count` - Unread count

## Test Credentials
- Email: `test@example.com`
- Password: `Test123!`

## Database (Neon PostgreSQL)
The database is already set up on Neon. Tables are auto-created on first request.

## License
MIT
