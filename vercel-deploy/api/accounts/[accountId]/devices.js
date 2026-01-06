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

  // GET - List devices
  if (req.method === 'GET') {
    try {
      const { extender_id } = req.query;
      let devices;
      
      if (extender_id) {
        devices = await sql`SELECT * FROM devices WHERE account_id = ${accountId} AND extender_id = ${extender_id}`;
      } else {
        devices = await sql`SELECT * FROM devices WHERE account_id = ${accountId}`;
      }
      
      return res.json(devices);
    } catch (error) {
      console.error('Get devices error:', error);
      return res.status(500).json({ detail: 'Failed to fetch devices' });
    }
  }

  // POST - Create device
  if (req.method === 'POST') {
    try {
      if (user.role !== 'admin') {
        return res.status(403).json({ detail: 'Admin access required' });
      }
      
      const { name, mac_address, device_type, extender_id } = req.body;
      const deviceId = `dev_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      
      await sql`
        INSERT INTO devices (device_id, account_id, extender_id, name, mac_address, device_type)
        VALUES (${deviceId}, ${accountId}, ${extender_id || null}, ${name}, ${mac_address}, ${device_type || 'unknown'})
      `;
      
      const deviceCount = await sql`SELECT COUNT(*) as count FROM devices WHERE account_id = ${accountId}`;
      await sql`UPDATE starlink_accounts SET devices_connected = ${parseInt(deviceCount[0].count)}, last_checked = CURRENT_TIMESTAMP WHERE account_id = ${accountId}`;
      
      const devices = await sql`SELECT * FROM devices WHERE device_id = ${deviceId}`;
      return res.json(devices[0]);
    } catch (error) {
      console.error('Create device error:', error);
      return res.status(500).json({ detail: 'Failed to create device' });
    }
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
