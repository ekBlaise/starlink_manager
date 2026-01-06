import { v4 as uuidv4 } from 'uuid';
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

  // GET - List all accounts
  if (req.method === 'GET') {
    try {
      const { search, status, account_status } = req.query;
      
      let accounts;
      if (search) {
        const searchPattern = `%${search}%`;
        accounts = await sql`
          SELECT * FROM starlink_accounts 
          WHERE (account_name ILIKE ${searchPattern} OR location ILIKE ${searchPattern} OR account_email ILIKE ${searchPattern} OR kit_number ILIKE ${searchPattern})
          ORDER BY created_at DESC
        `;
      } else {
        accounts = await sql`SELECT * FROM starlink_accounts ORDER BY created_at DESC`;
      }
      
      if (status === 'online') {
        accounts = accounts.filter(a => a.is_online === true);
      } else if (status === 'offline') {
        accounts = accounts.filter(a => a.is_online === false);
      }
      
      if (account_status && account_status !== 'all') {
        accounts = accounts.filter(a => a.status === account_status);
      }
      
      return res.json(accounts);
    } catch (error) {
      console.error('Get accounts error:', error);
      return res.status(500).json({ detail: 'Failed to fetch accounts' });
    }
  }

  // POST - Create new account
  if (req.method === 'POST') {
    try {
      if (user.role !== 'admin') {
        return res.status(403).json({ detail: 'Admin access required' });
      }
      
      const { account_name, location, account_email, kit_number, notes, billing_day, monthly_amount } = req.body;
      
      if (billing_day < 1 || billing_day > 31) {
        return res.status(400).json({ detail: 'Billing day must be between 1 and 31' });
      }
      
      const accountId = `acc_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      
      await sql`
        INSERT INTO starlink_accounts (account_id, account_name, location, account_email, kit_number, notes, billing_day, monthly_amount, user_id)
        VALUES (${accountId}, ${account_name}, ${location}, ${account_email}, ${kit_number}, ${notes || ''}, ${billing_day || 1}, ${monthly_amount || 0}, ${user.user_id})
      `;
      
      const accounts = await sql`SELECT * FROM starlink_accounts WHERE account_id = ${accountId}`;
      return res.json(accounts[0]);
    } catch (error) {
      console.error('Create account error:', error);
      return res.status(500).json({ detail: 'Failed to create account' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
