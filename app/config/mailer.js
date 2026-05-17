import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

let resendClient;

/**
 * Get or create the Resend client singleton.
 * Requires RESEND_API_KEY in environment variables.
 */
const getResendClient = () => {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ RESEND_API_KEY not configured. Email sending will be skipped.');
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
};

/**
 * Send an email using Resend.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} [options.html] - HTML body
 * @param {string} [options.text] - Plain text body
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const sendMail = async ({ to, subject, html, text }) => {
  const client = getResendClient();
  if (!client) {
    console.warn('Resend client not available. Skipping email send.');
    return { data: null, error: 'RESEND_API_KEY not configured' };
  }

  const from = process.env.MAIL_FROM || 'VisionIndex <onboarding@resend.dev>';

  const { data, error } = await client.emails.send({
    from,
    to,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  });

  if (error) {
    console.error('Resend email error:', error);
    throw new Error(error.message || 'Failed to send email via Resend');
  }

  console.log(`✅ Email sent to ${to} — ID: ${data?.id}`);
  return { data, error: null };
};
