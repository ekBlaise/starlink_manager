import { sql, initDatabase } from '../lib/db.js';
import { verifyPassword, createJwtToken, corsHeaders } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Session-ID');
    return res.status(200).end();
  }

  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  await initDatabase();

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
}
