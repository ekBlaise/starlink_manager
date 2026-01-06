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

  // GET - List extenders
  if (req.method === 'GET') {
    try {
      const extenders = await sql`SELECT * FROM extenders WHERE account_id = ${accountId}`;
      
      for (let ext of extenders) {
        const deviceCount = await sql`SELECT COUNT(*) as count FROM devices WHERE extender_id = ${ext.extender_id}`;
        ext.devices_connected = parseInt(deviceCount[0].count);
      }
      
      return res.json(extenders);
    } catch (error) {
      console.error('Get extenders error:', error);
      return res.status(500).json({ detail: 'Failed to fetch extenders' });
    }
  }

  // POST - Create extender
  if (req.method === 'POST') {
    try {
      if (user.role !== 'admin') {
        return res.status(403).json({ detail: 'Admin access required' });
      }
      
      const { name, ip_address, location } = req.body;
      const extenderId = `ext_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      
      await sql`
        INSERT INTO extenders (extender_id, account_id, name, ip_address, location)
        VALUES (${extenderId}, ${accountId}, ${name}, ${ip_address || ''}, ${location || ''})
      `;
      
      const extenders = await sql`SELECT * FROM extenders WHERE extender_id = ${extenderId}`;
      return res.json(extenders[0]);
    } catch (error) {
      console.error('Create extender error:', error);
      return res.status(500).json({ detail: 'Failed to create extender' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
