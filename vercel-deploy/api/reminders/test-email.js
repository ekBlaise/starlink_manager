import { initDatabase } from '../lib/db.js';
import { authenticateRequest, corsHeaders } from '../lib/auth.js';
import { sendEmail } from '../lib/notifications.js';

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
      const success = await sendEmail(
        user.email,
        'Starlink Manager - Test Email',
        `<h2>Test Email</h2><p>Hello ${user.name}, this is a test email from Starlink Manager.</p>`
      );
      return res.json({ success, message: success ? 'Test email sent' : 'Failed to send email' });
    } catch (error) {
      console.error('Test email error:', error);
      return res.status(500).json({ success: false, message: 'Failed to send email' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
