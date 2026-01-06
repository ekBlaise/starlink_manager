import { sql, initDatabase } from '../lib/db.js';
import { authenticateRequest, corsHeaders } from '../lib/auth.js';

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

  const { user, error } = await authenticateRequest(req);
  if (error) {
    return res.status(401).json({ detail: error });
  }

  if (req.method === 'GET') {
    const { password_hash, ...userData } = user;
    return res.json(userData);
  }

  if (req.method === 'PUT') {
    try {
      const { name, phone_number } = req.body;
      
      if (name !== undefined) {
        await sql`UPDATE users SET name = ${name} WHERE user_id = ${user.user_id}`;
      }
      if (phone_number !== undefined) {
        await sql`UPDATE users SET phone_number = ${phone_number} WHERE user_id = ${user.user_id}`;
      }
      
      const users = await sql`SELECT user_id, email, name, picture, phone_number, role, created_at FROM users WHERE user_id = ${user.user_id}`;
      return res.json(users[0]);
    } catch (error) {
      console.error('Update user error:', error);
      return res.status(500).json({ detail: 'Update failed' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
