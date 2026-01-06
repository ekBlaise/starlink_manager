import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export async function initDatabase() {
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
    
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database init error:', error);
  }
}

export { sql };
