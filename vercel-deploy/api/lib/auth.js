import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'starlink-manager-secret-key';
const JWT_EXPIRATION = '7d';

export const hashPassword = async (password) => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const createJwtToken = (userId) => {
  return jwt.sign({ user_id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

export const authenticateRequest = async (req) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const users = await sql`SELECT * FROM users WHERE user_id = ${decoded.user_id}`;
        if (users.length > 0) {
          return { user: users[0], error: null };
        }
      } catch (e) {
        if (e.name === 'TokenExpiredError') {
          return { user: null, error: 'Token expired' };
        }
      }
    }
    return { user: null, error: 'Not authenticated' };
  } catch (error) {
    return { user: null, error: 'Not authenticated' };
  }
};

export const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Session-ID',
};
