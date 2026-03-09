/**
 * Email Service
 *
 * Supports SendGrid and Gmail (OAuth2) as providers.
 * Queues outbound emails in the database and updates status on delivery.
 */

const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

// ─── Provider Setup ──────────────────────────────────────────

function getSendGridTransport() {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  return {
    async send({ to, toName, subject, body, replyTo }) {
      const msg = {
        to: toName ? { email: to, name: toName } : to,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL,
          name: process.env.SENDGRID_FROM_NAME || 'AI Job Agent',
        },
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>'),
        ...(replyTo && { replyTo }),
        trackingSettings: {
          clickTracking: { enable: false },
          openTracking: { enable: true },
        },
      };

      const [response] = await sgMail.send(msg);
      return { providerId: response.headers['x-message-id'] };
    },
  };
}

async function getGmailTransport() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  const { token } = await oauth2Client.getAccessToken();

  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER_EMAIL,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: token,
    },
  });

  return {
    async send({ to, toName, subject, body }) {
      const info = await transporter.sendMail({
        from: `"AI Job Agent" <${process.env.GMAIL_USER_EMAIL}>`,
        to: toName ? `"${toName}" <${to}>` : to,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>'),
      });

      return { providerId: info.messageId };
    },
  };
}

async function getTransport() {
  const provider = process.env.EMAIL_PROVIDER || 'sendgrid';
  if (provider === 'gmail') return getGmailTransport();
  return getSendGridTransport();
}

// ─── Queue & Send ────────────────────────────────────────────

/**
 * Persist email to DB and send immediately.
 */
async function sendEmail({ userId, applicationId, recruiterId, to, toName, subject, body, type }) {
  // Insert queued record
  const insertResult = await query(
    `INSERT INTO emails
       (user_id, application_id, recruiter_id, to_email, to_name, subject, body, type, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'queued')
     RETURNING id`,
    [userId, applicationId, recruiterId, to, toName, subject, body, type],
  );

  const emailId = insertResult.rows[0].id;

  try {
    const transport = await getTransport();
    const { providerId } = await transport.send({ to, toName, subject, body });

    await query(
      `UPDATE emails SET status = 'sent', sent_at = NOW(), provider_id = $1 WHERE id = $2`,
      [providerId, emailId],
    );

    logger.info(`Email sent [${type}] to ${to} (id: ${emailId})`);
    return { emailId, status: 'sent' };
  } catch (err) {
    await query(
      `UPDATE emails SET status = 'failed', error_message = $1 WHERE id = $2`,
      [err.message, emailId],
    );

    logger.error(`Email send failed to ${to}:`, err.message);
    return { emailId, status: 'failed', error: err.message };
  }
}

// ─── Follow-up Scheduler ─────────────────────────────────────

/**
 * Find applications older than N days with no follow-up sent,
 * generate follow-up email, and send.
 */
async function sendScheduledFollowUps(userId, daysSinceApplied = 10) {
  const { generateFollowUpEmail } = require('../ai/emailGenerator');

  const result = await query(
    `SELECT
       a.id, a.user_id, a.applied_at,
       j.company, j.role, j.location,
       u.full_name, u.email AS user_email,
       r.to_email AS recruiter_email, r.to_name AS recruiter_name
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN users u ON u.id = a.user_id
     LEFT JOIN emails r ON r.application_id = a.id AND r.type = 'cold_outreach'
     WHERE a.user_id = $1
       AND a.status = 'applied'
       AND a.applied_at <= NOW() - INTERVAL '${daysSinceApplied} days'
       AND a.follow_up_at IS NULL`,
    [userId],
  );

  const sent = [];

  for (const row of result.rows) {
    try {
      const candidate = { full_name: row.full_name };
      const job = { role: row.role, company: row.company };

      const { subject, body } = await generateFollowUpEmail({
        candidate,
        job,
        daysSinceApplied: Math.floor((Date.now() - new Date(row.applied_at)) / 86400000),
      });

      const toEmail = row.recruiter_email || row.user_email;

      const result2 = await sendEmail({
        userId,
        applicationId: row.id,
        to: toEmail,
        toName: row.recruiter_name,
        subject,
        body,
        type: 'follow_up',
      });

      // Mark follow-up sent
      await query(
        `UPDATE applications SET status = 'follow_up_sent', follow_up_at = NOW() WHERE id = $1`,
        [row.id],
      );

      sent.push({ applicationId: row.id, emailId: result2.emailId });
    } catch (err) {
      logger.error(`Follow-up error for application ${row.id}:`, err.message);
    }
  }

  return sent;
}

// ─── Daily Alert ─────────────────────────────────────────────

async function sendDailyAlert(userId) {
  const [jobsResult, appsResult, interviewsResult] = await Promise.all([
    query(
      `SELECT COUNT(*) FROM job_matches WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
      [userId],
    ),
    query(
      `SELECT COUNT(*) FROM applications WHERE user_id = $1 AND applied_at >= CURRENT_DATE`,
      [userId],
    ),
    query(
      `SELECT j.company, j.role, a.interview_at
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE a.user_id = $1 AND a.interview_at >= NOW() AND a.interview_at <= NOW() + INTERVAL '7 days'`,
      [userId],
    ),
  ]);

  const userResult = await query(`SELECT email, full_name FROM users WHERE id = $1`, [userId]);
  const user = userResult.rows[0];
  if (!user) return;

  const newJobs = parseInt(jobsResult.rows[0].count, 10);
  const applied = parseInt(appsResult.rows[0].count, 10);
  const interviews = interviewsResult.rows;

  const interviewText = interviews.length
    ? `\n\nUPCOMING INTERVIEWS:\n${interviews.map((i) => `• ${i.company} — ${i.role} on ${new Date(i.interview_at).toLocaleDateString()}`).join('\n')}`
    : '';

  const body = `Good morning, ${user.full_name}!

Here is your AI Job Agent daily summary:

📋 NEW MATCHED JOBS TODAY: ${newJobs}
✅ APPLICATIONS SUBMITTED TODAY: ${applied}${interviewText}

Log in to review your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard

— AI Job Agent`;

  await sendEmail({
    userId,
    to: user.email,
    toName: user.full_name,
    subject: `Your Daily Job Summary — ${new Date().toLocaleDateString()}`,
    body,
    type: 'daily_alert',
  });
}

module.exports = { sendEmail, sendScheduledFollowUps, sendDailyAlert };
