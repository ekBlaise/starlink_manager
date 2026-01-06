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

  // GET - List tickets
  if (req.method === 'GET') {
    try {
      const tickets = await sql`SELECT * FROM support_tickets WHERE account_id = ${accountId} ORDER BY created_at DESC`;
      return res.json(tickets);
    } catch (error) {
      console.error('Get tickets error:', error);
      return res.status(500).json({ detail: 'Failed to fetch tickets' });
    }
  }

  // POST - Create ticket
  if (req.method === 'POST') {
    try {
      const { title, description, priority } = req.body;
      const ticketId = `tkt_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      
      await sql`
        INSERT INTO support_tickets (ticket_id, account_id, title, description, priority)
        VALUES (${ticketId}, ${accountId}, ${title}, ${description}, ${priority || 'medium'})
      `;
      
      const tickets = await sql`SELECT * FROM support_tickets WHERE ticket_id = ${ticketId}`;
      return res.json(tickets[0]);
    } catch (error) {
      console.error('Create ticket error:', error);
      return res.status(500).json({ detail: 'Failed to create ticket' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
