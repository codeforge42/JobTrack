const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

/**
 * Export jobs array to an Excel file.
 * @param {string} sheetName - Worksheet name.
 * @param {Array} jobs - Array of { title, company, link }
 * @param {string} [outDir] - Optional output directory (defaults to backend/output)
 * @returns {string} - Path to written file
 */
const exportJobsToExcel = (sheetName, jobs = [], outDir = null) => {
  if (!Array.isArray(jobs)) jobs = [];

  const outputDir = outDir || path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `jobs-${sheetName.replace(/\s+/g, '_')}-${timestamp}.xlsx`;
  const filePath = path.join(outputDir, fileName);

  // Prepare rows
  const rows = jobs.map(job => ({
    Title: job.title || '',
    Link: job.link || '',
    Company: job.company || '',
    Timestamp: job.timestamp || new Date().toLocaleString(),
  }));

  console.log('rows',  rows);

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: ['Title', 'Link', 'Company', 'Timestamp'] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31)); // Excel sheet name max 31 chars

  // Write file
  XLSX.writeFile(workbook, filePath);
  return filePath;
};

module.exports = { exportJobsToExcel };
