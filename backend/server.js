const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { neon, neonConfig } = require('@neondatabase/serverless');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;

// Configure Neon
neonConfig.fetchConnectionCache = true;
const sql = neon(process.env.DATABASE_URL);

// JWT Config
const JWT_SECRET = process.env.JWT_SECRET || 'starlink-manager-secret-key';
const JWT_EXPIRATION = '7d';

// Twilio Config
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
}));
app.use(express.json({ limit: '10mb' }));

// ==================== DATABASE INIT ====================
async function initDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255),
        picture TEXT,
        phone_number VARCHAR(50),
        role VARCHAR(20) DEFAULT 'viewer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        session_token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS starlink_accounts (
        id SERIAL PRIMARY KEY,
        account_id VARCHAR(50) UNIQUE NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        account_email VARCHAR(255) NOT NULL,
        kit_number VARCHAR(100) NOT NULL,
        notes TEXT DEFAULT '',
        billing_day INTEGER DEFAULT 1,
        monthly_amount DECIMAL(10,2) DEFAULT 0,
        is_online BOOLEAN DEFAULT true,
        devices_connected INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS billing_records (
        id SERIAL PRIMARY KEY,
        billing_id VARCHAR(50) UNIQUE NOT NULL,
        account_id VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_date TIMESTAMP NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'manual',
        notes TEXT DEFAULT '',
        is_paid BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        ticket_id VARCHAR(50) UNIQUE NOT NULL,
        account_id VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS extenders (
        id SERIAL PRIMARY KEY,
        extender_id VARCHAR(50) UNIQUE NOT NULL,
        account_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        ip_address VARCHAR(50) DEFAULT '',
        location VARCHAR(255) DEFAULT '',
        is_online BOOLEAN DEFAULT true,
        devices_connected INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(50) UNIQUE NOT NULL,
        account_id VARCHAR(50) NOT NULL,
        extender_id VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        mac_address VARCHAR(50) NOT NULL,
        device_type VARCHAR(50) DEFAULT 'unknown',
        is_whitelisted BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        notification_id VARCHAR(50) UNIQUE NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        account_id VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        notification_type VARCHAR(50) DEFAULT 'system',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// ==================== AUTH HELPERS ====================
const hashPassword = async (password) => {
  return bcrypt.hash(password, 10);
};

const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const createJwtToken = (userId) => {
  return jwt.sign({ user_id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

const authenticateToken = async (req, res, next) => {
  try {
    // Check session_token cookie
    const sessionToken = req.cookies?.session_token;
    if (sessionToken) {
      const sessions = await sql`SELECT * FROM user_sessions WHERE session_token = ${sessionToken}`;
      if (sessions.length > 0 && new Date(sessions[0].expires_at) > new Date()) {
        const users = await sql`SELECT * FROM users WHERE user_id = ${sessions[0].user_id}`;
        if (users.length > 0) {
          req.user = users[0];
          return next();
        }
      }
    }
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const users = await sql`SELECT * FROM users WHERE user_id = ${decoded.user_id}`;
        if (users.length > 0) {
          req.user = users[0];
          return next();
        }
      } catch (e) {
        if (e.name === 'TokenExpiredError') {
          return res.status(401).json({ detail: 'Token expired' });
        }
      }
    }
    
    return res.status(401).json({ detail: 'Not authenticated' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ detail: 'Not authenticated' });
  }
};

// ==================== NOTIFICATION HELPERS ====================
const sendEmail = async (to, subject, html) => {
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
};

const sendSMS = async (to, message) => {
  try {
    if (!twilioClient) return false;
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`SMS sent to ${to}`);
    return true;
  } catch (error) {
    console.error('SMS error:', error);
    return false;
  }
};

const createNotification = async (userId, title, message, type, accountId = null) => {
  const notificationId = `notif_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  await sql`
    INSERT INTO notifications (notification_id, user_id, account_id, title, message, notification_type)
    VALUES (${notificationId}, ${userId}, ${accountId}, ${title}, ${message}, ${type})
  `;
  return notificationId;
};

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone_number } = req.body;
    
    const existing = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return res.status(400).json({ detail: 'Email already registered' });
    }
    
    const userId = `user_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const passwordHash = await hashPassword(password);
    
    await sql`
      INSERT INTO users (user_id, email, name, password_hash, phone_number, role)
      VALUES (${userId}, ${email}, ${name}, ${passwordHash}, ${phone_number || null}, 'admin')
    `;
    
    const token = createJwtToken(userId);
    res.json({
      token,
      user: { user_id: userId, email, name, phone_number, role: 'admin' }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ detail: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (users.length === 0 || !users[0].password_hash) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }
    
    const valid = await verifyPassword(password, users[0].password_hash);
    if (!valid) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }
    
    const user = users[0];
    const token = createJwtToken(user.user_id);
    res.json({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        phone_number: user.phone_number,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Login failed' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(400).json({ detail: 'Session ID required' });
    }
    
    // Fetch session data from Emergent Auth
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(
      'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
      { headers: { 'X-Session-ID': sessionId } }
    );
    
    if (!response.ok) {
      return res.status(401).json({ detail: 'Invalid session' });
    }
    
    const data = await response.json();
    
    // Check if user exists
    let users = await sql`SELECT * FROM users WHERE email = ${data.email}`;
    let userId;
    
    if (users.length === 0) {
      userId = `user_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      await sql`
        INSERT INTO users (user_id, email, name, picture, role)
        VALUES (${userId}, ${data.email}, ${data.name}, ${data.picture || null}, 'admin')
      `;
    } else {
      userId = users[0].user_id;
      await sql`UPDATE users SET name = ${data.name}, picture = ${data.picture || null} WHERE user_id = ${userId}`;
    }
    
    // Create session
    const sessionToken = data.session_token;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await sql`
      INSERT INTO user_sessions (user_id, session_token, expires_at)
      VALUES (${userId}, ${sessionToken}, ${expiresAt})
    `;
    
    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    const userResult = await sql`SELECT user_id, email, name, picture, phone_number, role, created_at FROM users WHERE user_id = ${userId}`;
    res.json(userResult[0]);
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ detail: 'Session creation failed' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const { password_hash, ...user } = req.user;
  res.json(user);
});

app.put('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { name, phone_number } = req.body;
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      await sql`UPDATE users SET name = ${name} WHERE user_id = ${req.user.user_id}`;
    }
    if (phone_number !== undefined) {
      await sql`UPDATE users SET phone_number = ${phone_number} WHERE user_id = ${req.user.user_id}`;
    }
    
    const users = await sql`SELECT user_id, email, name, picture, phone_number, role, created_at FROM users WHERE user_id = ${req.user.user_id}`;
    res.json(users[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ detail: 'Update failed' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const sessionToken = req.cookies?.session_token;
    if (sessionToken) {
      await sql`DELETE FROM user_sessions WHERE session_token = ${sessionToken}`;
    }
    res.clearCookie('session_token');
    res.json({ message: 'Logged out' });
  } catch (error) {
    res.json({ message: 'Logged out' });
  }
});

// ==================== ACCOUNTS ROUTES ====================
app.post('/api/accounts', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    const { account_name, location, account_email, kit_number, notes, billing_day, monthly_amount } = req.body;
    
    if (billing_day < 1 || billing_day > 31) {
      return res.status(400).json({ detail: 'Billing day must be between 1 and 31' });
    }
    
    const accountId = `acc_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    
    await sql`
      INSERT INTO starlink_accounts (account_id, account_name, location, account_email, kit_number, notes, billing_day, monthly_amount, user_id)
      VALUES (${accountId}, ${account_name}, ${location}, ${account_email}, ${kit_number}, ${notes || ''}, ${billing_day || 1}, ${monthly_amount || 0}, ${req.user.user_id})
    `;
    
    const accounts = await sql`SELECT * FROM starlink_accounts WHERE account_id = ${accountId}`;
    res.json(accounts[0]);
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ detail: 'Failed to create account' });
  }
});

app.get('/api/accounts', authenticateToken, async (req, res) => {
  try {
    const { search, status, account_status } = req.query;
    const userId = req.user.user_id;
    
    let accounts;
    if (search) {
      const searchPattern = `%${search}%`;
      accounts = await sql`
        SELECT * FROM starlink_accounts 
        WHERE user_id = ${userId} AND (account_name ILIKE ${searchPattern} OR location ILIKE ${searchPattern} OR account_email ILIKE ${searchPattern} OR kit_number ILIKE ${searchPattern})
        ORDER BY created_at DESC
      `;
    } else {
      accounts = await sql`SELECT * FROM starlink_accounts WHERE user_id = ${userId} ORDER BY created_at DESC`;
    }
    
    // Filter by online status
    if (status === 'online') {
      accounts = accounts.filter(a => a.is_online === true);
    } else if (status === 'offline') {
      accounts = accounts.filter(a => a.is_online === false);
    }
    
    // Filter by account status
    if (account_status && account_status !== 'all') {
      accounts = accounts.filter(a => a.status === account_status);
    }
    
    res.json(accounts);
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ detail: 'Failed to fetch accounts' });
  }
});

app.get('/api/accounts/:accountId', authenticateToken, async (req, res) => {
  try {
    const accounts = await sql`SELECT * FROM starlink_accounts WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (accounts.length === 0) {
      return res.status(404).json({ detail: 'Account not found' });
    }
    res.json(accounts[0]);
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ detail: 'Failed to fetch account' });
  }
});

app.put('/api/accounts/:accountId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    // Verify ownership
    const existing = await sql`SELECT * FROM starlink_accounts WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (existing.length === 0) {
      return res.status(404).json({ detail: 'Account not found' });
    }
    
    const { account_name, location, account_email, kit_number, notes, billing_day, monthly_amount, is_online, status } = req.body;
    
    if (billing_day !== undefined && (billing_day < 1 || billing_day > 31)) {
      return res.status(400).json({ detail: 'Billing day must be between 1 and 31' });
    }
    
    // Build dynamic update
    const updates = [];
    if (account_name !== undefined) updates.push(sql`account_name = ${account_name}`);
    if (location !== undefined) updates.push(sql`location = ${location}`);
    if (account_email !== undefined) updates.push(sql`account_email = ${account_email}`);
    if (kit_number !== undefined) updates.push(sql`kit_number = ${kit_number}`);
    if (notes !== undefined) updates.push(sql`notes = ${notes}`);
    if (billing_day !== undefined) updates.push(sql`billing_day = ${billing_day}`);
    if (monthly_amount !== undefined) updates.push(sql`monthly_amount = ${monthly_amount}`);
    if (is_online !== undefined) updates.push(sql`is_online = ${is_online}`);
    if (status !== undefined) updates.push(sql`status = ${status}`);
    
    await sql`UPDATE starlink_accounts SET last_checked = CURRENT_TIMESTAMP WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    
    // Apply individual updates
    if (account_name !== undefined) await sql`UPDATE starlink_accounts SET account_name = ${account_name} WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (location !== undefined) await sql`UPDATE starlink_accounts SET location = ${location} WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (account_email !== undefined) await sql`UPDATE starlink_accounts SET account_email = ${account_email} WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (kit_number !== undefined) await sql`UPDATE starlink_accounts SET kit_number = ${kit_number} WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (notes !== undefined) await sql`UPDATE starlink_accounts SET notes = ${notes} WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (billing_day !== undefined) await sql`UPDATE starlink_accounts SET billing_day = ${billing_day} WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (monthly_amount !== undefined) await sql`UPDATE starlink_accounts SET monthly_amount = ${monthly_amount} WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (is_online !== undefined) await sql`UPDATE starlink_accounts SET is_online = ${is_online} WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (status !== undefined) await sql`UPDATE starlink_accounts SET status = ${status} WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    
    const accounts = await sql`SELECT * FROM starlink_accounts WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    res.json(accounts[0]);
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ detail: 'Failed to update account' });
  }
});

app.delete('/api/accounts/:accountId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    // Verify ownership
    const existing = await sql`SELECT * FROM starlink_accounts WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    if (existing.length === 0) {
      return res.status(404).json({ detail: 'Account not found' });
    }
    
    await sql`DELETE FROM starlink_accounts WHERE account_id = ${req.params.accountId} AND user_id = ${req.user.user_id}`;
    await sql`DELETE FROM billing_records WHERE account_id = ${req.params.accountId}`;
    await sql`DELETE FROM support_tickets WHERE account_id = ${req.params.accountId}`;
    await sql`DELETE FROM extenders WHERE account_id = ${req.params.accountId}`;
    await sql`DELETE FROM devices WHERE account_id = ${req.params.accountId}`;
    
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ detail: 'Failed to delete account' });
  }
});
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    const result = await sql`DELETE FROM starlink_accounts WHERE account_id = ${req.params.accountId}`;
    await sql`DELETE FROM billing_records WHERE account_id = ${req.params.accountId}`;
    await sql`DELETE FROM support_tickets WHERE account_id = ${req.params.accountId}`;
    await sql`DELETE FROM extenders WHERE account_id = ${req.params.accountId}`;
    await sql`DELETE FROM devices WHERE account_id = ${req.params.accountId}`;
    
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ detail: 'Failed to delete account' });
  }
});

// ==================== BILLING ROUTES ====================
app.post('/api/accounts/:accountId/billing', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    const { amount, payment_date, payment_method, notes, is_paid } = req.body;
    const billingId = `bill_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    
    await sql`
      INSERT INTO billing_records (billing_id, account_id, amount, payment_date, payment_method, notes, is_paid)
      VALUES (${billingId}, ${req.params.accountId}, ${amount}, ${payment_date}, ${payment_method || 'manual'}, ${notes || ''}, ${is_paid !== false})
    `;
    
    const records = await sql`SELECT * FROM billing_records WHERE billing_id = ${billingId}`;
    res.json(records[0]);
  } catch (error) {
    console.error('Create billing error:', error);
    res.status(500).json({ detail: 'Failed to create billing record' });
  }
});

app.get('/api/accounts/:accountId/billing', authenticateToken, async (req, res) => {
  try {
    const records = await sql`SELECT * FROM billing_records WHERE account_id = ${req.params.accountId} ORDER BY payment_date DESC`;
    res.json(records);
  } catch (error) {
    console.error('Get billing error:', error);
    res.status(500).json({ detail: 'Failed to fetch billing records' });
  }
});

app.put('/api/accounts/:accountId/billing/:billingId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    const isPaid = req.query.is_paid === 'true';
    await sql`UPDATE billing_records SET is_paid = ${isPaid} WHERE billing_id = ${req.params.billingId}`;
    res.json({ message: 'Billing record updated' });
  } catch (error) {
    console.error('Update billing error:', error);
    res.status(500).json({ detail: 'Failed to update billing record' });
  }
});

app.delete('/api/accounts/:accountId/billing/:billingId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    await sql`DELETE FROM billing_records WHERE billing_id = ${req.params.billingId}`;
    res.json({ message: 'Billing record deleted' });
  } catch (error) {
    console.error('Delete billing error:', error);
    res.status(500).json({ detail: 'Failed to delete billing record' });
  }
});

// ==================== TICKETS ROUTES ====================
app.post('/api/accounts/:accountId/tickets', authenticateToken, async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const ticketId = `tkt_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    
    await sql`
      INSERT INTO support_tickets (ticket_id, account_id, title, description, priority)
      VALUES (${ticketId}, ${req.params.accountId}, ${title}, ${description}, ${priority || 'medium'})
    `;
    
    const tickets = await sql`SELECT * FROM support_tickets WHERE ticket_id = ${ticketId}`;
    res.json(tickets[0]);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ detail: 'Failed to create ticket' });
  }
});

app.get('/api/accounts/:accountId/tickets', authenticateToken, async (req, res) => {
  try {
    const tickets = await sql`SELECT * FROM support_tickets WHERE account_id = ${req.params.accountId} ORDER BY created_at DESC`;
    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ detail: 'Failed to fetch tickets' });
  }
});

app.put('/api/accounts/:accountId/tickets/:ticketId', authenticateToken, async (req, res) => {
  try {
    const { title, description, priority, status } = req.body;
    
    if (title !== undefined) await sql`UPDATE support_tickets SET title = ${title} WHERE ticket_id = ${req.params.ticketId}`;
    if (description !== undefined) await sql`UPDATE support_tickets SET description = ${description} WHERE ticket_id = ${req.params.ticketId}`;
    if (priority !== undefined) await sql`UPDATE support_tickets SET priority = ${priority} WHERE ticket_id = ${req.params.ticketId}`;
    if (status !== undefined) await sql`UPDATE support_tickets SET status = ${status} WHERE ticket_id = ${req.params.ticketId}`;
    await sql`UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE ticket_id = ${req.params.ticketId}`;
    
    const tickets = await sql`SELECT * FROM support_tickets WHERE ticket_id = ${req.params.ticketId}`;
    res.json(tickets[0]);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ detail: 'Failed to update ticket' });
  }
});

app.delete('/api/accounts/:accountId/tickets/:ticketId', authenticateToken, async (req, res) => {
  try {
    await sql`DELETE FROM support_tickets WHERE ticket_id = ${req.params.ticketId}`;
    res.json({ message: 'Ticket deleted' });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ detail: 'Failed to delete ticket' });
  }
});

// ==================== EXTENDERS ROUTES ====================
app.post('/api/accounts/:accountId/extenders', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    const { name, ip_address, location } = req.body;
    const extenderId = `ext_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    
    await sql`
      INSERT INTO extenders (extender_id, account_id, name, ip_address, location)
      VALUES (${extenderId}, ${req.params.accountId}, ${name}, ${ip_address || ''}, ${location || ''})
    `;
    
    const extenders = await sql`SELECT * FROM extenders WHERE extender_id = ${extenderId}`;
    res.json(extenders[0]);
  } catch (error) {
    console.error('Create extender error:', error);
    res.status(500).json({ detail: 'Failed to create extender' });
  }
});

app.get('/api/accounts/:accountId/extenders', authenticateToken, async (req, res) => {
  try {
    const extenders = await sql`SELECT * FROM extenders WHERE account_id = ${req.params.accountId}`;
    
    // Count devices for each extender
    for (let ext of extenders) {
      const deviceCount = await sql`SELECT COUNT(*) as count FROM devices WHERE extender_id = ${ext.extender_id}`;
      ext.devices_connected = parseInt(deviceCount[0].count);
    }
    
    res.json(extenders);
  } catch (error) {
    console.error('Get extenders error:', error);
    res.status(500).json({ detail: 'Failed to fetch extenders' });
  }
});

app.put('/api/accounts/:accountId/extenders/:extenderId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    const { name, ip_address, location, is_online } = req.body;
    
    if (name !== undefined) await sql`UPDATE extenders SET name = ${name} WHERE extender_id = ${req.params.extenderId}`;
    if (ip_address !== undefined) await sql`UPDATE extenders SET ip_address = ${ip_address} WHERE extender_id = ${req.params.extenderId}`;
    if (location !== undefined) await sql`UPDATE extenders SET location = ${location} WHERE extender_id = ${req.params.extenderId}`;
    if (is_online !== undefined) await sql`UPDATE extenders SET is_online = ${is_online} WHERE extender_id = ${req.params.extenderId}`;
    
    const extenders = await sql`SELECT * FROM extenders WHERE extender_id = ${req.params.extenderId}`;
    res.json(extenders[0]);
  } catch (error) {
    console.error('Update extender error:', error);
    res.status(500).json({ detail: 'Failed to update extender' });
  }
});

app.delete('/api/accounts/:accountId/extenders/:extenderId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    await sql`DELETE FROM extenders WHERE extender_id = ${req.params.extenderId}`;
    await sql`UPDATE devices SET extender_id = NULL WHERE extender_id = ${req.params.extenderId}`;
    res.json({ message: 'Extender deleted' });
  } catch (error) {
    console.error('Delete extender error:', error);
    res.status(500).json({ detail: 'Failed to delete extender' });
  }
});

// ==================== DEVICES ROUTES ====================
app.post('/api/accounts/:accountId/devices', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    const { name, mac_address, device_type, extender_id } = req.body;
    const deviceId = `dev_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    
    await sql`
      INSERT INTO devices (device_id, account_id, extender_id, name, mac_address, device_type)
      VALUES (${deviceId}, ${req.params.accountId}, ${extender_id || null}, ${name}, ${mac_address}, ${device_type || 'unknown'})
    `;
    
    // Update device count
    const deviceCount = await sql`SELECT COUNT(*) as count FROM devices WHERE account_id = ${req.params.accountId}`;
    await sql`UPDATE starlink_accounts SET devices_connected = ${parseInt(deviceCount[0].count)}, last_checked = CURRENT_TIMESTAMP WHERE account_id = ${req.params.accountId}`;
    
    const devices = await sql`SELECT * FROM devices WHERE device_id = ${deviceId}`;
    res.json(devices[0]);
  } catch (error) {
    console.error('Create device error:', error);
    res.status(500).json({ detail: 'Failed to create device' });
  }
});

app.get('/api/accounts/:accountId/devices', authenticateToken, async (req, res) => {
  try {
    const { extender_id } = req.query;
    let devices;
    
    if (extender_id) {
      devices = await sql`SELECT * FROM devices WHERE account_id = ${req.params.accountId} AND extender_id = ${extender_id}`;
    } else {
      devices = await sql`SELECT * FROM devices WHERE account_id = ${req.params.accountId}`;
    }
    
    res.json(devices);
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ detail: 'Failed to fetch devices' });
  }
});

app.put('/api/accounts/:accountId/devices/:deviceId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    const { name, mac_address, device_type, is_whitelisted, extender_id } = req.body;
    
    if (name !== undefined) await sql`UPDATE devices SET name = ${name} WHERE device_id = ${req.params.deviceId}`;
    if (mac_address !== undefined) await sql`UPDATE devices SET mac_address = ${mac_address} WHERE device_id = ${req.params.deviceId}`;
    if (device_type !== undefined) await sql`UPDATE devices SET device_type = ${device_type} WHERE device_id = ${req.params.deviceId}`;
    if (is_whitelisted !== undefined) await sql`UPDATE devices SET is_whitelisted = ${is_whitelisted} WHERE device_id = ${req.params.deviceId}`;
    if (extender_id !== undefined) await sql`UPDATE devices SET extender_id = ${extender_id} WHERE device_id = ${req.params.deviceId}`;
    
    const devices = await sql`SELECT * FROM devices WHERE device_id = ${req.params.deviceId}`;
    res.json(devices[0]);
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ detail: 'Failed to update device' });
  }
});

app.delete('/api/accounts/:accountId/devices/:deviceId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    await sql`DELETE FROM devices WHERE device_id = ${req.params.deviceId}`;
    
    // Update device count
    const deviceCount = await sql`SELECT COUNT(*) as count FROM devices WHERE account_id = ${req.params.accountId}`;
    await sql`UPDATE starlink_accounts SET devices_connected = ${parseInt(deviceCount[0].count)}, last_checked = CURRENT_TIMESTAMP WHERE account_id = ${req.params.accountId}`;
    
    res.json({ message: 'Device deleted' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ detail: 'Failed to delete device' });
  }
});

// ==================== NOTIFICATIONS ROUTES ====================
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { unread_only } = req.query;
    let notifications;
    
    if (unread_only === 'true') {
      notifications = await sql`SELECT * FROM notifications WHERE user_id = ${req.user.user_id} AND is_read = false ORDER BY created_at DESC LIMIT 100`;
    } else {
      notifications = await sql`SELECT * FROM notifications WHERE user_id = ${req.user.user_id} ORDER BY created_at DESC LIMIT 100`;
    }
    
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ detail: 'Failed to fetch notifications' });
  }
});

app.get('/api/notifications/count', authenticateToken, async (req, res) => {
  try {
    const result = await sql`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${req.user.user_id} AND is_read = false`;
    res.json({ unread_count: parseInt(result[0].count) });
  } catch (error) {
    console.error('Get notification count error:', error);
    res.status(500).json({ detail: 'Failed to fetch notification count' });
  }
});

app.put('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    await sql`UPDATE notifications SET is_read = true WHERE notification_id = ${req.params.notificationId} AND user_id = ${req.user.user_id}`;
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ detail: 'Failed to mark notification as read' });
  }
});

app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await sql`UPDATE notifications SET is_read = true WHERE user_id = ${req.user.user_id}`;
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ detail: 'Failed to mark all notifications as read' });
  }
});

app.delete('/api/notifications/:notificationId', authenticateToken, async (req, res) => {
  try {
    await sql`DELETE FROM notifications WHERE notification_id = ${req.params.notificationId} AND user_id = ${req.user.user_id}`;
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ detail: 'Failed to delete notification' });
  }
});

// ==================== REMINDERS ROUTES ====================
app.post('/api/reminders/check', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ detail: 'Admin access required' });
    }
    
    // Get active accounts with upcoming payments
    const accounts = await sql`SELECT * FROM starlink_accounts WHERE status = 'active'`;
    const now = new Date();
    const currentDay = now.getDate();
    
    for (const account of accounts) {
      const billingDay = account.billing_day;
      let daysUntil;
      
      if (billingDay >= currentDay) {
        daysUntil = billingDay - currentDay;
      } else {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        daysUntil = (daysInMonth - currentDay) + billingDay;
      }
      
      if ([5, 3, 1].includes(daysUntil)) {
        const title = `Payment Reminder: ${account.account_name}`;
        const message = `Payment of $${account.monthly_amount} for ${account.account_name} is due in ${daysUntil} day(s) on day ${billingDay}.`;
        
        // Create in-app notification
        await createNotification(req.user.user_id, title, message, 'payment_reminder', account.account_id);
        
        // Send email
        const emailHtml = `
          <h2>Payment Reminder</h2>
          <p>Hello ${req.user.name},</p>
          <p>Your Starlink payment is coming up:</p>
          <ul>
            <li><strong>Account:</strong> ${account.account_name}</li>
            <li><strong>Location:</strong> ${account.location}</li>
            <li><strong>Amount:</strong> $${account.monthly_amount}</li>
            <li><strong>Due Date:</strong> Day ${billingDay} (${daysUntil} days away)</li>
          </ul>
          <p>Best regards,<br>Starlink Manager</p>
        `;
        await sendEmail(req.user.email, title, emailHtml);
        
        // Send SMS if phone number available
        if (req.user.phone_number) {
          await sendSMS(req.user.phone_number, `${title}: $${account.monthly_amount} due in ${daysUntil} day(s).`);
        }
      }
    }
    
    res.json({ message: 'Reminder check initiated' });
  } catch (error) {
    console.error('Check reminders error:', error);
    res.status(500).json({ detail: 'Failed to check reminders' });
  }
});

app.post('/api/reminders/test-email', authenticateToken, async (req, res) => {
  try {
    const success = await sendEmail(
      req.user.email,
      'Starlink Manager - Test Email',
      `<h2>Test Email</h2><p>Hello ${req.user.name}, this is a test email from Starlink Manager.</p>`
    );
    res.json({ success, message: success ? 'Test email sent' : 'Failed to send email' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});

app.post('/api/reminders/test-sms', authenticateToken, async (req, res) => {
  try {
    if (!req.user.phone_number) {
      return res.status(400).json({ detail: 'Phone number not set in profile' });
    }
    
    const success = await sendSMS(req.user.phone_number, `Starlink Manager Test: Hello ${req.user.name}!`);
    res.json({ success, message: success ? 'Test SMS sent' : 'Failed to send SMS' });
  } catch (error) {
    console.error('Test SMS error:', error);
    res.status(500).json({ success: false, message: 'Failed to send SMS' });
  }
});

// ==================== DASHBOARD ROUTES ====================
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const totalAccounts = await sql`SELECT COUNT(*) as count FROM starlink_accounts`;
    const onlineAccounts = await sql`SELECT COUNT(*) as count FROM starlink_accounts WHERE is_online = true`;
    const activeAccounts = await sql`SELECT COUNT(*) as count FROM starlink_accounts WHERE status = 'active'`;
    const inactiveAccounts = await sql`SELECT COUNT(*) as count FROM starlink_accounts WHERE status IN ('inactive', 'cancelled')`;
    const openTickets = await sql`SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'`;
    const totalDevices = await sql`SELECT COUNT(*) as count FROM devices`;
    const unreadNotifications = await sql`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${req.user.user_id} AND is_read = false`;
    
    // Get upcoming payments
    const accounts = await sql`SELECT * FROM starlink_accounts WHERE status = 'active'`;
    const now = new Date();
    const currentDay = now.getDate();
    
    const upcomingPayments = [];
    for (const account of accounts) {
      const billingDay = account.billing_day;
      let daysUntil;
      
      if (billingDay >= currentDay) {
        daysUntil = billingDay - currentDay;
      } else {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        daysUntil = (daysInMonth - currentDay) + billingDay;
      }
      
      if (daysUntil <= 7) {
        upcomingPayments.push({
          account_id: account.account_id,
          account_name: account.account_name,
          amount: parseFloat(account.monthly_amount),
          billing_day: account.billing_day,
          days_until: daysUntil
        });
      }
    }
    
    upcomingPayments.sort((a, b) => a.days_until - b.days_until);
    
    // Get recent payments
    const recentPayments = await sql`
      SELECT b.*, a.account_name 
      FROM billing_records b 
      LEFT JOIN starlink_accounts a ON b.account_id = a.account_id 
      ORDER BY b.created_at DESC 
      LIMIT 5
    `;
    
    res.json({
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
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ detail: 'Failed to fetch dashboard stats' });
  }
});

app.get('/api/dashboard/all-tickets', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let tickets;
    
    if (status) {
      tickets = await sql`SELECT * FROM support_tickets WHERE status = ${status} ORDER BY created_at DESC LIMIT 100`;
    } else {
      tickets = await sql`SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 100`;
    }
    
    res.json(tickets);
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({ detail: 'Failed to fetch tickets' });
  }
});

// ==================== START SERVER ====================
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});

module.exports = app;
