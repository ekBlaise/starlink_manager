import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { v4 as uuidv4 } from 'uuid';
import { sql } from './db.js';

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

export const sendEmail = async (to, subject, html) => {
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_EMAIL,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
};

export const sendSMS = async (to, message) => {
  try {
    if (!twilioClient) return false;
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    return true;
  } catch (error) {
    console.error('SMS error:', error);
    return false;
  }
};

export const createNotification = async (userId, title, message, type, accountId = null) => {
  const notificationId = `notif_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  await sql`
    INSERT INTO notifications (notification_id, user_id, account_id, title, message, notification_type)
    VALUES (${notificationId}, ${userId}, ${accountId}, ${title}, ${message}, ${type})
  `;
  return notificationId;
};
