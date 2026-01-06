import { initDatabase } from '../lib/db.js';
import { authenticateRequest, corsHeaders } from '../lib/auth.js';
import { sendSMS } from '../lib/notifications.js';

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

  if (req.method === 'POST') {
    try {
      if (!user.phone_number) {
        return res.status(400).json({ detail: 'Phone number not set in profile' });
      }
      
      const success = await sendSMS(user.phone_number, `Starlink Manager Test: Hello ${user.name}!`);
      return res.json({ success, message: success ? 'Test SMS sent' : 'Failed to send SMS' });
    } catch (error) {
      console.error('Test SMS error:', error);
      return res.status(500).json({ success: false, message: 'Failed to send SMS' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
