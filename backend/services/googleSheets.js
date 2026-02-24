const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load credentials
// const credentialsPath = path.join(__dirname, '../credentials.json');
// const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

// const auth = new google.auth.GoogleServiceAccount({
//   email: credentials.client_email,
//   key: credentials.private_key,
//   scopes: ['https://www.googleapis.com/auth/spreadsheets'],
// });

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Append jobs to a Google Sheet
 * @param {string} spreadsheetId - The Google Sheet ID
 * @param {string} sheetName - The sheet name (tab name)
 * @param {Array} jobs - Array of job objects with { title, company, link }
 * @returns {Promise}
 */
const appendJobsToSheet = async (spreadsheetId, sheetName, jobs) => {
  try {
    if (!jobs || jobs.length === 0) {
      console.log('No jobs to append');
      return;
    }

    // Transform jobs into rows for the sheet
    const values = jobs.map(job => [
      new Date().toLocaleString(), // Add timestamp
      '',
      job.title || '',
      job.link || '',
      job.company || '',
      '',
      'Not Applied', // Default status
      '',
      '',
      ''
    ]);

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:J`, // Columns: Title, Company, Link, Timestamp, Status, Notes, etc.
      valueInputOption: 'RAW',
      resource: {
        values,
      },
    });

    console.log(`✅ Appended ${response.data.updates.updatedRows} rows to Google Sheet`);
    return response.data;
  } catch (error) {
    console.error('Error appending to Google Sheet:', error.message);
    throw error;
  }
};

/**
 * Update a specific cell in Google Sheet
 * @param {string} spreadsheetId - The Google Sheet ID
 * @param {string} range - The cell range (e.g., "Sheet1!A1")
 * @param {*} value - The value to set
 */
const updateCell = async (spreadsheetId, range, value) => {
  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: {
        values: [[value]],
      },
    });

    console.log(`✅ Updated cell ${range}`);
    return response.data;
  } catch (error) {
    console.error('Error updating cell:', error.message);
    throw error;
  }
};

/**
 * Clear all data from a sheet
 * @param {string} spreadsheetId - The Google Sheet ID
 * @param {string} range - The range to clear (e.g., "Sheet1!A:D")
 */
const clearSheet = async (spreadsheetId, range) => {
  try {
    const response = await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });

    console.log(`✅ Cleared range ${range}`);
    return response.data;
  } catch (error) {
    console.error('Error clearing sheet:', error.message);
    throw error;
  }
};

module.exports = {
  appendJobsToSheet,
  updateCell,
  clearSheet,
};
