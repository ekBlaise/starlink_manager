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
      const { unread_only } = req.query;
      let notifications;
      
      if (unread_only === 'true') {
        notifications = await sql`SELECT * FROM notifications WHERE user_id = ${user.user_id} AND is_read = false ORDER BY created_at DESC LIMIT 100`;
      } else {
        notifications = await sql`SELECT * FROM notifications WHERE user_id = ${user.user_id} ORDER BY created_at DESC LIMIT 100`;
      }
      
      return res.json(notifications);
    } catch (error) {
      console.error('Get notifications error:', error);
      return res.status(500).json({ detail: 'Failed to fetch notifications' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
