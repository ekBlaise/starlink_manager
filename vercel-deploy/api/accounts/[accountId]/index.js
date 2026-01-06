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

  const { accountId } = req.query;

  // GET - Get single account
  if (req.method === 'GET') {
    try {
      const accounts = await sql`SELECT * FROM starlink_accounts WHERE account_id = ${accountId}`;
      if (accounts.length === 0) {
        return res.status(404).json({ detail: 'Account not found' });
      }
      return res.json(accounts[0]);
    } catch (error) {
      console.error('Get account error:', error);
      return res.status(500).json({ detail: 'Failed to fetch account' });
    }
  }

  // PUT - Update account
  if (req.method === 'PUT') {
    try {
      if (user.role !== 'admin') {
        return res.status(403).json({ detail: 'Admin access required' });
      }
      
      const { account_name, location, account_email, kit_number, notes, billing_day, monthly_amount, is_online, status } = req.body;
      
      if (billing_day !== undefined && (billing_day < 1 || billing_day > 31)) {
        return res.status(400).json({ detail: 'Billing day must be between 1 and 31' });
      }
      
      await sql`UPDATE starlink_accounts SET last_checked = CURRENT_TIMESTAMP WHERE account_id = ${accountId}`;
      
      if (account_name !== undefined) await sql`UPDATE starlink_accounts SET account_name = ${account_name} WHERE account_id = ${accountId}`;
      if (location !== undefined) await sql`UPDATE starlink_accounts SET location = ${location} WHERE account_id = ${accountId}`;
      if (account_email !== undefined) await sql`UPDATE starlink_accounts SET account_email = ${account_email} WHERE account_id = ${accountId}`;
      if (kit_number !== undefined) await sql`UPDATE starlink_accounts SET kit_number = ${kit_number} WHERE account_id = ${accountId}`;
      if (notes !== undefined) await sql`UPDATE starlink_accounts SET notes = ${notes} WHERE account_id = ${accountId}`;
      if (billing_day !== undefined) await sql`UPDATE starlink_accounts SET billing_day = ${billing_day} WHERE account_id = ${accountId}`;
      if (monthly_amount !== undefined) await sql`UPDATE starlink_accounts SET monthly_amount = ${monthly_amount} WHERE account_id = ${accountId}`;
      if (is_online !== undefined) await sql`UPDATE starlink_accounts SET is_online = ${is_online} WHERE account_id = ${accountId}`;
      if (status !== undefined) await sql`UPDATE starlink_accounts SET status = ${status} WHERE account_id = ${accountId}`;
      
      const accounts = await sql`SELECT * FROM starlink_accounts WHERE account_id = ${accountId}`;
      return res.json(accounts[0]);
    } catch (error) {
      console.error('Update account error:', error);
      return res.status(500).json({ detail: 'Failed to update account' });
    }
  }

  // DELETE - Delete account
  if (req.method === 'DELETE') {
    try {
      if (user.role !== 'admin') {
        return res.status(403).json({ detail: 'Admin access required' });
      }
      
      await sql`DELETE FROM starlink_accounts WHERE account_id = ${accountId}`;
      await sql`DELETE FROM billing_records WHERE account_id = ${accountId}`;
      await sql`DELETE FROM support_tickets WHERE account_id = ${accountId}`;
      await sql`DELETE FROM extenders WHERE account_id = ${accountId}`;
      await sql`DELETE FROM devices WHERE account_id = ${accountId}`;
      
      return res.json({ message: 'Account deleted' });
    } catch (error) {
      console.error('Delete account error:', error);
      return res.status(500).json({ detail: 'Failed to delete account' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
