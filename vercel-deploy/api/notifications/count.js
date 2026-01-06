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
    try {
      const result = await sql`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${user.user_id} AND is_read = false`;
      return res.json({ unread_count: parseInt(result[0].count) });
    } catch (error) {
      console.error('Get notification count error:', error);
      return res.status(500).json({ detail: 'Failed to fetch notification count' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
