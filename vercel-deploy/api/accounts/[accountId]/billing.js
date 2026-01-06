import { v4 as uuidv4 } from 'uuid';
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

  const { accountId } = req.query;

  // GET - List billing records
  if (req.method === 'GET') {
    try {
      const records = await sql`SELECT * FROM billing_records WHERE account_id = ${accountId} ORDER BY payment_date DESC`;
      return res.json(records);
    } catch (error) {
      console.error('Get billing error:', error);
      return res.status(500).json({ detail: 'Failed to fetch billing records' });
    }
  }

  // POST - Create billing record
  if (req.method === 'POST') {
    try {
      if (user.role !== 'admin') {
        return res.status(403).json({ detail: 'Admin access required' });
      }
      
      const { amount, payment_date, payment_method, notes, is_paid } = req.body;
      const billingId = `bill_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      
      await sql`
        INSERT INTO billing_records (billing_id, account_id, amount, payment_date, payment_method, notes, is_paid)
        VALUES (${billingId}, ${accountId}, ${amount}, ${payment_date}, ${payment_method || 'manual'}, ${notes || ''}, ${is_paid !== false})
      `;
      
      const records = await sql`SELECT * FROM billing_records WHERE billing_id = ${billingId}`;
      return res.json(records[0]);
    } catch (error) {
      console.error('Create billing error:', error);
      return res.status(500).json({ detail: 'Failed to create billing record' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
