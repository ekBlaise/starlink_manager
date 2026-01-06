import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

// Lazy initialization for database
let sql = null;
function getDb() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

// JWT Config
const JWT_SECRET = process.env.JWT_SECRET || 'starlink-manager-secret-key';
const JWT_EXPIRATION = '7d';

// Lazy Twilio initialization
let twilioClient = null;
function getTwilio() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

// Lazy email transporter
let emailTransporter = null;
function getEmailTransporter() {
  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return emailTransporter;
}

// Initialize database tables
async function initDatabase() {
  const db = getDb();
  try {
    await db`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, user_id VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL, password_hash VARCHAR(255), picture TEXT, phone_number VARCHAR(50), role VARCHAR(20) DEFAULT 'viewer', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await db`CREATE TABLE IF NOT EXISTS starlink_accounts (id SERIAL PRIMARY KEY, account_id VARCHAR(50) UNIQUE NOT NULL, account_name VARCHAR(255) NOT NULL, location VARCHAR(255) NOT NULL, account_email VARCHAR(255) NOT NULL, kit_number VARCHAR(100) NOT NULL, notes TEXT DEFAULT '', billing_day INTEGER DEFAULT 1, monthly_amount DECIMAL(10,2) DEFAULT 0, is_online BOOLEAN DEFAULT true, devices_connected INTEGER DEFAULT 0, status VARCHAR(20) DEFAULT 'active', last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP, user_id VARCHAR(50) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await db`CREATE TABLE IF NOT EXISTS billing_records (id SERIAL PRIMARY KEY, billing_id VARCHAR(50) UNIQUE NOT NULL, account_id VARCHAR(50) NOT NULL, amount DECIMAL(10,2) NOT NULL, payment_date TIMESTAMP NOT NULL, payment_method VARCHAR(50) DEFAULT 'manual', notes TEXT DEFAULT '', is_paid BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await db`CREATE TABLE IF NOT EXISTS support_tickets (id SERIAL PRIMARY KEY, ticket_id VARCHAR(50) UNIQUE NOT NULL, account_id VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT NOT NULL, priority VARCHAR(20) DEFAULT 'medium', status VARCHAR(20) DEFAULT 'open', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await db`CREATE TABLE IF NOT EXISTS extenders (id SERIAL PRIMARY KEY, extender_id VARCHAR(50) UNIQUE NOT NULL, account_id VARCHAR(50) NOT NULL, name VARCHAR(255) NOT NULL, ip_address VARCHAR(50) DEFAULT '', location VARCHAR(255) DEFAULT '', is_online BOOLEAN DEFAULT true, devices_connected INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await db`CREATE TABLE IF NOT EXISTS devices (id SERIAL PRIMARY KEY, device_id VARCHAR(50) UNIQUE NOT NULL, account_id VARCHAR(50) NOT NULL, extender_id VARCHAR(50), name VARCHAR(255) NOT NULL, mac_address VARCHAR(50) NOT NULL, device_type VARCHAR(50) DEFAULT 'unknown', is_whitelisted BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await db`CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, notification_id VARCHAR(50) UNIQUE NOT NULL, user_id VARCHAR(50) NOT NULL, account_id VARCHAR(50), title VARCHAR(255) NOT NULL, message TEXT NOT NULL, notification_type VARCHAR(50) DEFAULT 'system', is_read BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  } catch (error) {
    console.error('Database init error:', error);
    throw error;
  }
}

// Auth helpers
const hashPassword = async (password) => bcrypt.hash(password, 10);
const verifyPassword = async (password, hash) => bcrypt.compare(password, hash);
const createJwtToken = (userId) => jwt.sign({ user_id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const db = getDb();
      const users = await db`SELECT * FROM users WHERE user_id = ${decoded.user_id}`;
      if (users.length > 0) return { user: users[0], error: null };
    } catch (e) {
      if (e.name === 'TokenExpiredError') return { user: null, error: 'Token expired' };
    }
  }
  return { user: null, error: 'Not authenticated' };
}

// Notification helpers
const sendEmail = async (to, subject, html) => {
  try {
    const transporter = getEmailTransporter();
    await transporter.sendMail({ from: process.env.SMTP_EMAIL, to, subject, html });
    return true;
  } catch (error) { 
    console.error('Email error:', error);
    return false; 
  }
};

const sendSMS = async (to, message) => {
  try {
    const client = getTwilio();
    if (!client) return false;
    await client.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER, to });
    return true;
  } catch (error) { 
    console.error('SMS error:', error);
    return false; 
  }
};

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Session-ID');
}

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const url = req.url.replace(/\?.*$/, '');
  const pathParts = url.split('/').filter(Boolean);
  const route = pathParts.slice(1).join('/');
  const method = req.method;

  console.log(`API Request: ${method} ${route}`);

  try {
    await initDatabase();
    const db = getDb();

    // AUTH ROUTES
    if (route === 'auth/register' && method === 'POST') {
      const { email, password, name, phone_number } = req.body;
      console.log('Register attempt for:', email);
      
      if (!email || !password || !name) {
        return res.status(400).json({ detail: 'Email, password, and name are required' });
      }
      
      const existing = await db`SELECT * FROM users WHERE email = ${email}`;
      if (existing.length > 0) return res.status(400).json({ detail: 'Email already registered' });
      
      const userId = `user_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      const passwordHash = await hashPassword(password);
      await db`INSERT INTO users (user_id, email, name, password_hash, phone_number, role) VALUES (${userId}, ${email}, ${name}, ${passwordHash}, ${phone_number || null}, 'admin')`;
      const token = createJwtToken(userId);
      console.log('User registered:', userId);
      return res.json({ token, user: { user_id: userId, email, name, phone_number, role: 'admin' } });
    }

    if (route === 'auth/login' && method === 'POST') {
      const { email, password } = req.body;
      console.log('Login attempt for:', email);
      
      const users = await db`SELECT * FROM users WHERE email = ${email}`;
      if (users.length === 0 || !users[0].password_hash) return res.status(401).json({ detail: 'Invalid credentials' });
      const valid = await verifyPassword(password, users[0].password_hash);
      if (!valid) return res.status(401).json({ detail: 'Invalid credentials' });
      const user = users[0];
      const token = createJwtToken(user.user_id);
      return res.json({ token, user: { user_id: user.user_id, email: user.email, name: user.name, phone_number: user.phone_number, role: user.role } });
    }

    if (route === 'auth/me') {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      if (method === 'GET') {
        const { password_hash, ...userData } = user;
        return res.json(userData);
      }
      if (method === 'PUT') {
        const { name, phone_number } = req.body;
        if (name !== undefined) await db`UPDATE users SET name = ${name} WHERE user_id = ${user.user_id}`;
        if (phone_number !== undefined) await db`UPDATE users SET phone_number = ${phone_number} WHERE user_id = ${user.user_id}`;
        const users = await db`SELECT user_id, email, name, picture, phone_number, role, created_at FROM users WHERE user_id = ${user.user_id}`;
        return res.json(users[0]);
      }
    }

    // ACCOUNTS ROUTES
    if (route === 'accounts') {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      
      if (method === 'GET') {
        const { search, status, account_status } = req.query;
        let accounts = search 
          ? await db`SELECT * FROM starlink_accounts WHERE (account_name ILIKE ${'%'+search+'%'} OR location ILIKE ${'%'+search+'%'} OR account_email ILIKE ${'%'+search+'%'}) ORDER BY created_at DESC`
          : await db`SELECT * FROM starlink_accounts ORDER BY created_at DESC`;
        if (status === 'online') accounts = accounts.filter(a => a.is_online === true);
        else if (status === 'offline') accounts = accounts.filter(a => a.is_online === false);
        if (account_status && account_status !== 'all') accounts = accounts.filter(a => a.status === account_status);
        return res.json(accounts);
      }
      
      if (method === 'POST') {
        if (user.role !== 'admin') return res.status(403).json({ detail: 'Admin access required' });
        const { account_name, location, account_email, kit_number, notes, billing_day, monthly_amount } = req.body;
        if (billing_day < 1 || billing_day > 31) return res.status(400).json({ detail: 'Billing day must be between 1 and 31' });
        const accountId = `acc_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
        await db`INSERT INTO starlink_accounts (account_id, account_name, location, account_email, kit_number, notes, billing_day, monthly_amount, user_id) VALUES (${accountId}, ${account_name}, ${location}, ${account_email}, ${kit_number}, ${notes || ''}, ${billing_day || 1}, ${monthly_amount || 0}, ${user.user_id})`;
        const accounts = await db`SELECT * FROM starlink_accounts WHERE account_id = ${accountId}`;
        return res.json(accounts[0]);
      }
    }

    // ACCOUNT BY ID ROUTES
    const accountMatch = route.match(/^accounts\/([^\/]+)$/);
    if (accountMatch) {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      const accountId = accountMatch[1];
      
      if (method === 'GET') {
        const accounts = await db`SELECT * FROM starlink_accounts WHERE account_id = ${accountId}`;
        if (accounts.length === 0) return res.status(404).json({ detail: 'Account not found' });
        return res.json(accounts[0]);
      }
      
      if (method === 'PUT') {
        if (user.role !== 'admin') return res.status(403).json({ detail: 'Admin access required' });
        const { account_name, location, account_email, kit_number, notes, billing_day, monthly_amount, is_online, status } = req.body;
        if (account_name !== undefined) await db`UPDATE starlink_accounts SET account_name = ${account_name} WHERE account_id = ${accountId}`;
        if (location !== undefined) await db`UPDATE starlink_accounts SET location = ${location} WHERE account_id = ${accountId}`;
        if (account_email !== undefined) await db`UPDATE starlink_accounts SET account_email = ${account_email} WHERE account_id = ${accountId}`;
        if (kit_number !== undefined) await db`UPDATE starlink_accounts SET kit_number = ${kit_number} WHERE account_id = ${accountId}`;
        if (notes !== undefined) await db`UPDATE starlink_accounts SET notes = ${notes} WHERE account_id = ${accountId}`;
        if (billing_day !== undefined) await db`UPDATE starlink_accounts SET billing_day = ${billing_day} WHERE account_id = ${accountId}`;
        if (monthly_amount !== undefined) await db`UPDATE starlink_accounts SET monthly_amount = ${monthly_amount} WHERE account_id = ${accountId}`;
        if (is_online !== undefined) await db`UPDATE starlink_accounts SET is_online = ${is_online} WHERE account_id = ${accountId}`;
        if (status !== undefined) await db`UPDATE starlink_accounts SET status = ${status} WHERE account_id = ${accountId}`;
        const accounts = await db`SELECT * FROM starlink_accounts WHERE account_id = ${accountId}`;
        return res.json(accounts[0]);
      }
      
      if (method === 'DELETE') {
        if (user.role !== 'admin') return res.status(403).json({ detail: 'Admin access required' });
        await db`DELETE FROM starlink_accounts WHERE account_id = ${accountId}`;
        await db`DELETE FROM billing_records WHERE account_id = ${accountId}`;
        await db`DELETE FROM support_tickets WHERE account_id = ${accountId}`;
        return res.json({ message: 'Account deleted' });
      }
    }

    // BILLING ROUTES
    const billingMatch = route.match(/^accounts\/([^\/]+)\/billing$/);
    if (billingMatch) {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      const accountId = billingMatch[1];
      
      if (method === 'GET') {
        const records = await db`SELECT * FROM billing_records WHERE account_id = ${accountId} ORDER BY payment_date DESC`;
        return res.json(records);
      }
      
      if (method === 'POST') {
        if (user.role !== 'admin') return res.status(403).json({ detail: 'Admin access required' });
        const { amount, payment_date, payment_method, notes, is_paid } = req.body;
        const billingId = `bill_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
        await db`INSERT INTO billing_records (billing_id, account_id, amount, payment_date, payment_method, notes, is_paid) VALUES (${billingId}, ${accountId}, ${amount}, ${payment_date}, ${payment_method || 'manual'}, ${notes || ''}, ${is_paid !== false})`;
        const records = await db`SELECT * FROM billing_records WHERE billing_id = ${billingId}`;
        return res.json(records[0]);
      }
    }

    // TICKETS ROUTES
    const ticketsMatch = route.match(/^accounts\/([^\/]+)\/tickets$/);
    if (ticketsMatch) {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      const accountId = ticketsMatch[1];
      
      if (method === 'GET') {
        const tickets = await db`SELECT * FROM support_tickets WHERE account_id = ${accountId} ORDER BY created_at DESC`;
        return res.json(tickets);
      }
      
      if (method === 'POST') {
        const { title, description, priority } = req.body;
        const ticketId = `tkt_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
        await db`INSERT INTO support_tickets (ticket_id, account_id, title, description, priority) VALUES (${ticketId}, ${accountId}, ${title}, ${description}, ${priority || 'medium'})`;
        const tickets = await db`SELECT * FROM support_tickets WHERE ticket_id = ${ticketId}`;
        return res.json(tickets[0]);
      }
    }

    // EXTENDERS ROUTES
    const extendersMatch = route.match(/^accounts\/([^\/]+)\/extenders$/);
    if (extendersMatch) {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      const accountId = extendersMatch[1];
      
      if (method === 'GET') {
        const extenders = await db`SELECT * FROM extenders WHERE account_id = ${accountId}`;
        return res.json(extenders);
      }
      
      if (method === 'POST') {
        if (user.role !== 'admin') return res.status(403).json({ detail: 'Admin access required' });
        const { name, ip_address, location } = req.body;
        const extenderId = `ext_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
        await db`INSERT INTO extenders (extender_id, account_id, name, ip_address, location) VALUES (${extenderId}, ${accountId}, ${name}, ${ip_address || ''}, ${location || ''})`;
        const extenders = await db`SELECT * FROM extenders WHERE extender_id = ${extenderId}`;
        return res.json(extenders[0]);
      }
    }

    // DEVICES ROUTES
    const devicesMatch = route.match(/^accounts\/([^\/]+)\/devices$/);
    if (devicesMatch) {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      const accountId = devicesMatch[1];
      
      if (method === 'GET') {
        const devices = await db`SELECT * FROM devices WHERE account_id = ${accountId}`;
        return res.json(devices);
      }
      
      if (method === 'POST') {
        if (user.role !== 'admin') return res.status(403).json({ detail: 'Admin access required' });
        const { name, mac_address, device_type, extender_id } = req.body;
        const deviceId = `dev_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
        await db`INSERT INTO devices (device_id, account_id, extender_id, name, mac_address, device_type) VALUES (${deviceId}, ${accountId}, ${extender_id || null}, ${name}, ${mac_address}, ${device_type || 'unknown'})`;
        const devices = await db`SELECT * FROM devices WHERE device_id = ${deviceId}`;
        return res.json(devices[0]);
      }
    }

    // NOTIFICATIONS ROUTES
    if (route === 'notifications') {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      
      if (method === 'GET') {
        const { unread_only } = req.query;
        const notifications = unread_only === 'true'
          ? await db`SELECT * FROM notifications WHERE user_id = ${user.user_id} AND is_read = false ORDER BY created_at DESC LIMIT 100`
          : await db`SELECT * FROM notifications WHERE user_id = ${user.user_id} ORDER BY created_at DESC LIMIT 100`;
        return res.json(notifications);
      }
    }

    if (route === 'notifications/count') {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      const result = await db`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${user.user_id} AND is_read = false`;
      return res.json({ unread_count: parseInt(result[0].count) });
    }

    // DASHBOARD ROUTES
    if (route === 'dashboard/stats') {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      
      const totalAccounts = await db`SELECT COUNT(*) as count FROM starlink_accounts`;
      const onlineAccounts = await db`SELECT COUNT(*) as count FROM starlink_accounts WHERE is_online = true`;
      const activeAccounts = await db`SELECT COUNT(*) as count FROM starlink_accounts WHERE status = 'active'`;
      const inactiveAccounts = await db`SELECT COUNT(*) as count FROM starlink_accounts WHERE status IN ('inactive', 'cancelled')`;
      const openTickets = await db`SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'`;
      const totalDevices = await db`SELECT COUNT(*) as count FROM devices`;
      const unreadNotifications = await db`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${user.user_id} AND is_read = false`;
      
      const accounts = await db`SELECT * FROM starlink_accounts WHERE status = 'active'`;
      const now = new Date();
      const currentDay = now.getDate();
      const upcomingPayments = [];
      for (const account of accounts) {
        const billingDay = account.billing_day;
        let daysUntil = billingDay >= currentDay ? billingDay - currentDay : (new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - currentDay) + billingDay;
        if (daysUntil <= 7) upcomingPayments.push({ account_id: account.account_id, account_name: account.account_name, amount: parseFloat(account.monthly_amount), billing_day: account.billing_day, days_until: daysUntil });
      }
      upcomingPayments.sort((a, b) => a.days_until - b.days_until);
      
      const recentPayments = await db`SELECT b.*, a.account_name FROM billing_records b LEFT JOIN starlink_accounts a ON b.account_id = a.account_id ORDER BY b.created_at DESC LIMIT 5`;
      
      return res.json({
        total_accounts: parseInt(totalAccounts[0].count),
        online_accounts: parseInt(onlineAccounts[0].count),
        offline_accounts: parseInt(totalAccounts[0].count) - parseInt(onlineAccounts[0].count),
        active_accounts: parseInt(activeAccounts[0].count),
        inactive_accounts: parseInt(inactiveAccounts[0].count),
        open_tickets: parseInt(openTickets[0].count),
        total_devices: parseInt(totalDevices[0].count),
        unread_notifications: parseInt(unreadNotifications[0].count),
        upcoming_payments: upcomingPayments,
        recent_payments: recentPayments
      });
    }

    // REMINDERS ROUTES
    if (route === 'reminders/test-email' && method === 'POST') {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      const success = await sendEmail(user.email, 'Starlink Manager - Test Email', `<h2>Test Email</h2><p>Hello ${user.name}, this is a test email from Starlink Manager.</p>`);
      return res.json({ success, message: success ? 'Test email sent' : 'Failed to send email' });
    }

    if (route === 'reminders/test-sms' && method === 'POST') {
      const { user, error } = await authenticateRequest(req);
      if (error) return res.status(401).json({ detail: error });
      if (!user.phone_number) return res.status(400).json({ detail: 'Phone number not set in profile' });
      const success = await sendSMS(user.phone_number, `Starlink Manager Test: Hello ${user.name}!`);
      return res.json({ success, message: success ? 'Test SMS sent' : 'Failed to send SMS' });
    }

    return res.status(404).json({ detail: 'Not found', route, method });
  } catch (error) {
    console.error('API Error:', error.message, error.stack);
    return res.status(500).json({ detail: error.message || 'Internal server error' });
  }
}
