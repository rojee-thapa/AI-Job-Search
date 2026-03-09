/**
 * Google Sheets Tracking Service
 *
 * Syncs application data to a Google Sheets spreadsheet,
 * providing a familiar tracker equivalent.
 * Uses service account authentication.
 */

const { google } = require('googleapis');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getAuthClient() {
  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
  if (!credentialsJson) throw new Error('GOOGLE_SHEETS_CREDENTIALS_JSON not set');

  const credentials = JSON.parse(credentialsJson);
  return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not set');
  return id;
}

// ─── Sheet Initialisation ────────────────────────────────────

const HEADERS = [
  'Application ID',
  'Company',
  'Role',
  'Location',
  'Work Mode',
  'Match Score',
  'Status',
  'Date Applied',
  'Follow-up Date',
  'Interview Date',
  'Salary Min',
  'Salary Max',
  'Job Link',
  'Auto Applied',
  'Notes',
];

const STATUS_COLORS = {
  pending:             { red: 0.95, green: 0.95, blue: 0.95 },
  applied:             { red: 0.68, green: 0.85, blue: 1.0 },
  follow_up_sent:      { red: 0.8,  green: 0.9,  blue: 1.0 },
  interview_scheduled: { red: 1.0,  green: 0.92, blue: 0.6 },
  interviewed:         { red: 1.0,  green: 0.85, blue: 0.4 },
  offer_received:      { red: 0.6,  green: 0.95, blue: 0.6 },
  rejected:            { red: 1.0,  green: 0.7,  blue: 0.7 },
  withdrawn:           { red: 0.85, green: 0.85, blue: 0.85 },
};

async function ensureSheetSetup(sheets, spreadsheetId) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames = meta.data.sheets.map((s) => s.properties.title);

    if (!sheetNames.includes('Applications')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: 'Applications' } } }],
        },
      });
    }

    // Write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Applications!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });

    // Bold headers
    const sheetId = meta.data.sheets.find((s) => s.properties.title === 'Applications')?.properties.sheetId || 0;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.2, green: 0.2, blue: 0.6 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        }],
      },
    });
  } catch (err) {
    logger.warn('Sheet setup warning:', err.message);
  }
}

// ─── Sync Applications ───────────────────────────────────────

async function syncApplicationsToSheets(userId) {
  const auth = getAuthClient();
  const spreadsheetId = getSheetId();
  const sheets = google.sheets({ version: 'v4', auth });

  await ensureSheetSetup(sheets, spreadsheetId);

  const result = await query(
    `SELECT
       a.id, a.status, a.applied_at, a.follow_up_at, a.interview_at,
       a.auto_applied, a.notes,
       j.company, j.role, j.location, j.work_mode,
       j.salary_min, j.salary_max, j.application_url,
       jm.overall_score
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     LEFT JOIN job_matches jm ON jm.id = a.match_id
     WHERE a.user_id = $1
     ORDER BY a.created_at ASC`,
    [userId],
  );

  const rows = result.rows.map((row) => [
    row.id,
    row.company,
    row.role,
    row.location || '',
    row.work_mode || '',
    row.overall_score ? `${row.overall_score}%` : '',
    row.status,
    row.applied_at ? new Date(row.applied_at).toLocaleDateString() : '',
    row.follow_up_at ? new Date(row.follow_up_at).toLocaleDateString() : '',
    row.interview_at ? new Date(row.interview_at).toLocaleDateString() : '',
    row.salary_min ? `$${row.salary_min.toLocaleString()}` : '',
    row.salary_max ? `$${row.salary_max.toLocaleString()}` : '',
    row.application_url || '',
    row.auto_applied ? 'Yes' : 'No',
    row.notes || '',
  ]);

  if (!rows.length) return { synced: 0 };

  // Clear existing data (keep headers)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Applications!A2:Z',
  });

  // Write all rows
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Applications!A2',
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  // Apply status colour coding
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetId = meta.data.sheets.find((s) => s.properties.title === 'Applications')?.properties.sheetId || 0;

  const colorRequests = rows.map((row, idx) => {
    const status = row[6];
    const color = STATUS_COLORS[status] || STATUS_COLORS.pending;
    return {
      repeatCell: {
        range: { sheetId, startRowIndex: idx + 1, endRowIndex: idx + 2 },
        cell: { userEnteredFormat: { backgroundColor: color } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    };
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: colorRequests },
  });

  logger.info(`Google Sheets: synced ${rows.length} applications for user ${userId}`);
  return { synced: rows.length };
}

/**
 * Update a single application row's status and colour.
 */
async function updateApplicationInSheet(userId, applicationId) {
  try {
    await syncApplicationsToSheets(userId);
  } catch (err) {
    logger.error('Sheets update error:', err.message);
  }
}

module.exports = { syncApplicationsToSheets, updateApplicationInSheet };
