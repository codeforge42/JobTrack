const express = require('express');
const path = require('path');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');
const Company = require('../models/Company');
const User = require('../models/User');
const { analyzeJobLinks } = require('../services/analyzeJobLinks');
const { response } = require('../server');

// Fetch companies per customer
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let companies = await Company.getCompanyById(id) || [];

    res.status(201).json({
      success: true,
      message: 'Fetch companies successfully',
      companies: companies
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a company per customer
router.delete('/:id/:companyId', async (req, res) => {
  const { id, companyId } = req.params;
  try {
    let companies = await Company.getCompanyById(id) || [];

    // Ensure companies is an array
    if (!Array.isArray(companies)) {
      return res.status(500).json({ success: false, message: 'Invalid companies data format' });
    }
    companies = companies.filter(company => company.id !== companyId);

    const user = await Company.updateCompany({ id, companies });

    res.status(201).json({
      success: true,
      message: 'Delete a company successfully',
      companies: user.companies
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a company per customer
router.put('/:id/:companyId', async (req, res) => {
  const { id, companyId } = req.params;
  const { name, website, selector, linkedin, notes, period: period,  } = req.body;
  try {
    let companies = await Company.getCompanyById(id) || [];

    // Ensure companies is an array
    if (!Array.isArray(companies)) {
      return res.status(500).json({ success: false, message: 'Invalid companies data format' });
    }
    // Find the company by id and update its properties
    const companyIndex = companies.findIndex(company => company.id === companyId);
    if (companyIndex === -1) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    let admin = await User.getByEmail('admin@evgeny.com');
    let flag = false;
    let newcompanies = []; 
    if (admin && admin.companies && admin.companies.length > 0) {
      for (const company of admin.companies) {
        if (company.name === name || (company.website && website.includes(company.website)) || (company.linkedin && linkedin.includes(company.linkedin))) {
          if (website && website !== companies[companyIndex].website) {
            if (company.pages.some(page => page.link === website)) { }
            else {
              company.pages.push({ link: website, selector: selector, notes: notes, period: period, last_scan_date: '', jobs: [] });
              flag = true;
            }
          }
          if (linkedin && linkedin !== companies[companyIndex].linkedin) {
            if (company.pages.some(page => page.link === linkedin)) { }
            else {
              company.pages.push({ link: linkedin, selector: selector, notes: notes, period: period, last_scan_date: '', jobs: [] });
              flag = true;
            }
          }
        }
        newcompanies.push(company);
      }
      if (flag) {
        await User.updateAdmin(newcompanies);
      }
    }

    
    companies[companyIndex] = {
      ...companies[companyIndex],
      name: name,
      website: website,
      selector: selector,
      linkedin: linkedin,
      notes: notes,
      period: period,
    };

    await Company.updateCompany({ id, companies });

    res.status(201).json({
      success: true,
      message: 'Update a company successfully',
      company: companies[companyIndex]
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add a company to a user(customer)
router.post('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { name, website, selector, linkedin, notes, period } = req.body;


    let admin = await User.getByEmail('admin@evgeny.com');
    let flag = false;
    let newcompanies = []; 
    if (admin && admin.companies && admin.companies.length > 0) {
      for (const company of admin.companies) {
        if (company.name === name || (company.website && website.includes(company.website)) || (company.linkedin && linkedin.includes(company.linkedin))) {
          if (website) {
            if (company.pages.some(page => page.link === website)) { }
            else {
              company.pages.push({ link: website, selector: selector, notes: notes, period: period, last_scan_date: '', jobs: [] });
              flag = true;
            }
          }
          if (linkedin) {
            if (company.pages.some(page => page.link === linkedin)) { }
            else {
              company.pages.push({ link: linkedin, selector: selector, notes: notes, period: period, last_scan_date: '', jobs: [] });
              flag = true;
            }
          }
        }
        newcompanies.push(company);
      }
      if (flag) {
        await User.updateAdmin(newcompanies);
      }
    }
    // Check if user exists
    let companies = await Company.getCompanyById(id) || [];

    // Ensure companies is an array
    if (!Array.isArray(companies)) {
      return res.status(500).json({ success: false, message: 'Invalid companies data format' });
    }

    // Add the new company to the companies array
    companies.push({
      id: crypto.randomBytes(16).toString('hex'), // Generate a 32-bit random string
      name: name,
      website: website,
      selector: selector,
      linkedin: linkedin,
      last_scan_date: null,
      notes: notes,
      period: period,
      jobs: [],
    });

    console.log('Updated companies list:', companies);
    const user = await Company.updateCompany({ id, companies });
    res.status(201).json({
      success: true,
      message: 'Company added successfully',
      companies: user.companies
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Scan a company for a (customer)
router.put('/:id/:companyId/scan', async (req, res) => {
  try {
    const { scanTypes } = req.body;
    // scan the company
    const response = await Company.scanCompany({ ...req.params, scanTypes: scanTypes || ['website', 'linkedin'] });

    res.status(201).json({
      success: true,
      message: 'Company scanned successfully',
      company: JSON.stringify(response)
    });
  } catch (error) {
    console.error('Scanning error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Scan all companies for a (customer)
router.post('/:id/scan', async (req, res) => {
  const { id } = req.params;
  const { scanTypes } = req.body;
  try {
    // scan the company
    const companies = await Company.scanCompany({ id: id, companyId: '', scanTypes: scanTypes || ['website', 'linkedin'] });

    res.status(201).json({
      success: true,
      message: 'Company scanned successfully',
      companies: companies
    });
  } catch (error) {
    console.error('Scanning error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Delete records for a (company)
router.post('/:id/:companyId/deleteRecords', async (req, res) => {
  try {

    console.log('Deleting records for company:', req.params.id, req.params.companyId);
    // scan the company
    await Company.deleteRecord({ ...req.params, sourceType: req.body.sourceType });

    res.status(201).json({
      success: true,
      message: 'Company records deleted successfully',
    });
  } catch (error) {
    console.error('Deleting error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Delete all records for a (customer)
router.post('/:id/deleteRecords', async (req, res) => {
  const { id } = req.params;
  try {
    // scan the company
    await Company.deleteRecord({ id: id, companyId: '' });

    res.status(201).json({
      success: true,
      message: 'All records deleted successfully',
    });
  } catch (error) {
    console.error('Deleting error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Analyze job links from JobLinks.xlsx and return new Excel with Remote column
router.post('/:id/analyze-job-links', async (req, res) => {
  try {
    const { filePath, fileName } = await analyzeJobLinks();
    res.download(path.resolve(filePath), fileName, (err) => {
      if (err) {
        console.error('Download error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Failed to send file' });
        }
      }
    });
  } catch (error) {
    console.error('Analyze job links error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to analyze job links',
    });
  }
});

module.exports = router;