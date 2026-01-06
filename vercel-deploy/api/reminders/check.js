import { sql, initDatabase } from '../lib/db.js';
import { authenticateRequest, corsHeaders } from '../lib/auth.js';
import { sendEmail, sendSMS, createNotification } from '../lib/notifications.js';

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
      if (user.role !== 'admin') {
        return res.status(403).json({ detail: 'Admin access required' });
      }
      
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
          
          await createNotification(user.user_id, title, message, 'payment_reminder', account.account_id);
          
          const emailHtml = `
            <h2>Payment Reminder</h2>
            <p>Hello ${user.name},</p>
            <p>Your Starlink payment is coming up:</p>
            <ul>
              <li><strong>Account:</strong> ${account.account_name}</li>
              <li><strong>Location:</strong> ${account.location}</li>
              <li><strong>Amount:</strong> $${account.monthly_amount}</li>
              <li><strong>Due Date:</strong> Day ${billingDay} (${daysUntil} days away)</li>
            </ul>
            <p>Best regards,<br>Starlink Manager</p>
          `;
          await sendEmail(user.email, title, emailHtml);
          
          if (user.phone_number) {
            await sendSMS(user.phone_number, `${title}: $${account.monthly_amount} due in ${daysUntil} day(s).`);
          }
        }
      }
      
      return res.json({ message: 'Reminder check initiated' });
    } catch (error) {
      console.error('Check reminders error:', error);
      return res.status(500).json({ detail: 'Failed to check reminders' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
