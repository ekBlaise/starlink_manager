import { v4 as uuidv4 } from 'uuid';
import { sql, initDatabase } from '../lib/db.js';
import { hashPassword, verifyPassword, createJwtToken, corsHeaders } from '../lib/auth.js';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Session-ID');
    return res.status(200).end();
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  await initDatabase();

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
}
