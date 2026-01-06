import { sql, initDatabase } from '../../lib/db.js';
import { authenticateRequest, corsHeaders } from '../../lib/auth.js';

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

  const { notificationId } = req.query;

  if (req.method === 'PUT') {
    try {
      await sql`UPDATE notifications SET is_read = true WHERE notification_id = ${notificationId} AND user_id = ${user.user_id}`;
      return res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Mark notification read error:', error);
      return res.status(500).json({ detail: 'Failed to mark notification as read' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM notifications WHERE notification_id = ${notificationId} AND user_id = ${user.user_id}`;
      return res.json({ message: 'Notification deleted' });
    } catch (error) {
      console.error('Delete notification error:', error);
      return res.status(500).json({ detail: 'Failed to delete notification' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
