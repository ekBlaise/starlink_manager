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
      const totalAccounts = await sql`SELECT COUNT(*) as count FROM starlink_accounts`;
      const onlineAccounts = await sql`SELECT COUNT(*) as count FROM starlink_accounts WHERE is_online = true`;
      const activeAccounts = await sql`SELECT COUNT(*) as count FROM starlink_accounts WHERE status = 'active'`;
      const inactiveAccounts = await sql`SELECT COUNT(*) as count FROM starlink_accounts WHERE status IN ('inactive', 'cancelled')`;
      const openTickets = await sql`SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'`;
      const totalDevices = await sql`SELECT COUNT(*) as count FROM devices`;
      const unreadNotifications = await sql`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${user.user_id} AND is_read = false`;
      
      const accounts = await sql`SELECT * FROM starlink_accounts WHERE status = 'active'`;
      const now = new Date();
      const currentDay = now.getDate();
      
      const upcomingPayments = [];
      for (const account of accounts) {
        const billingDay = account.billing_day;
        let daysUntil;
        
        if (billingDay >= currentDay) {
          daysUntil = billingDay - currentDay;
        } else {
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          daysUntil = (daysInMonth - currentDay) + billingDay;
        }
        
        if (daysUntil <= 7) {
          upcomingPayments.push({
            account_id: account.account_id,
            account_name: account.account_name,
            amount: parseFloat(account.monthly_amount),
            billing_day: account.billing_day,
            days_until: daysUntil
          });
        }
      }
      
      upcomingPayments.sort((a, b) => a.days_until - b.days_until);
      
      const recentPayments = await sql`
        SELECT b.*, a.account_name 
        FROM billing_records b 
        LEFT JOIN starlink_accounts a ON b.account_id = a.account_id 
        ORDER BY b.created_at DESC 
        LIMIT 5
      `;
      
      return res.json({
        total_accounts: parseInt(totalAccounts[0].count),
        online_accounts: parseInt(onlineAccounts[0].count),
        offline_accounts: parseInt(totalAccounts[0].count) - parseInt(onlineAccounts[0].count),
        active_accounts: parseInt(activeAccounts[0].count),
        inactive_accounts: parseInt(inactiveAccounts[0].count),
        open_tickets: parseInt(openTickets[0].count),
        total_devices: parseInt(totalDevices[0].count),
        unread_notifications: parseInt(unreadNotifications[0].count),
        upcoming_payments: upcomingPayments,
        recent_payments: recentPayments
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      return res.status(500).json({ detail: 'Failed to fetch dashboard stats' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
