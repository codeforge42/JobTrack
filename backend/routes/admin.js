
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const { boolean } = require('zod');
const Scraper = require('../services/scraper.js');
const Classifier = require('../services/classifier.js');
const crypto = require('crypto');

// Change password
router.put('/password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    // Check if user exists
    const user = await User.getByEmail(email);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Verify password
    let isMatch;
    if (user.email === 'admin@evgeny.com') isMatch = (currentPassword == user.password);
    else {
      if (currentPassword === '') isMatch = true;
      else isMatch = await User.verifyPassword(currentPassword, user.password);
    }
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Update password
    User.updatePassword(user.email, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Fetch scanconfig for admin
router.get('/', async (req, res) => {
  try {
    let user = await User.getByEmail("admin@evgeny.com");


    res.status(201).json({
      success: true,
      message: 'Fetch companies successfully',
      user: user,
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Fetch jobs per customer for admin
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let user = await User.getByEmail("admin@evgeny.com");
    res.status(201).json({
      success: true,
      message: 'Fetch companies successfully',
      customer: user.companies[id]
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Fetch scanconfig for admin
router.delete('/', async (req, res) => {
  const customer = req.body.customer;
  try {
    let user = await User.getByEmail("admin@evgeny.com");
    let companies = user.companies || [];
    let newcompanies = [];
    for (const company of companies) {
      if (company.name !== customer.name && (!customer.website || company.website !== customer.website) && (!customer.linkedin || company.linkedin !== customer.linkedin)) {
        newcompanies.push(company);
      }
    }

    await User.updateAdmin(newcompanies);
    res.status(201).json({
      success: true,
      message: 'Company deleted successfully',
      companies: newcompanies,
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Fetch scanconfig for admin
router.post('/scan-config', async (req, res) => {
  try {
    let user = await User.getByEmail("admin@evgeny.com");
    res.status(201).json({
      success: true,
      message: 'Fetch companies successfully',
      scan_config: JSON.stringify([user.period, user.key] || [])
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Fetch scanconfig for admin
router.put('/scanPage', async (req, res) => {
  const { name, link } = req.body;
  try {
    let user = await User.getByEmail("admin@evgeny.com");

    let companies = user.companies || [];
    let newcompanies = [];
    const apiKey = user.key;
    const Classifier_Obj = new Classifier(apiKey);
    let classified_jobList = [];
    const options = {
      customPrompt:
        'Analyze the following job posting. Does it describe a technical position like Software, Architect, Developer, QA, AQA, or DevOps? If yes, return a short explanation; if not, respond with "No match".',
    };
    for (const company of companies) {
      if (company.name === name) {
        let id = 0, linkJobList, jobList = [];
        for (const page of company.pages) {
          if (link == '' || page.link === link) {
            if (link) {
              linkJobList = await Scraper(link, apiKey, link.includes('linkedin') ? 2 : 1);
            } else {
              linkJobList = await Scraper(page.link, apiKey, page.link.includes('linkedin') ? 2 : 1);
            }
            jobList = [...JSON.parse(linkJobList.jobs)];
            classified_jobList = await Promise.all(
              jobList.map(async (job) => {
                const jobPosting = {
                  title: job.title,
                  company: company.name,
                  description: job.detail,
                };
                if (apiKey) {
                  const result = await Classifier_Obj.classifyJobPosting(jobPosting, options);
                  return {
                    id: crypto.randomBytes(16).toString('hex'),
                    title: job.title,
                    description: result,
                    link: job.link,
                  };
                } else {
                  return {
                    id: crypto.randomBytes(16).toString('hex'),
                    title: job.title,
                    description: job.detail,
                    link: job.link,
                  };
                }
              })
            );

            console.log('classifying completed');
            company.pages[id].jobs = [...classified_jobList];
            company.pages[id].last_scan_date = new Date().toISOString();
            company.last_scan_date = new Date().toISOString();
          }
          id ++;
        }

      }
      newcompanies.push(company);
    }
    await User.updateAdmin(newcompanies);
    res.status(201).json({
      success: true,
      message: 'Fetch companies successfully',
      companies: newcompanies
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { name, website, linkedin } = req.body;
  try {
    // Check if user exists
    const user = await User.getByEmail('admin@evgeny.com');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }
    let companies = user.companies || [];
    let exist = false;
    for (const company of companies) {
      if (company.name === name || (website && company.website === website) || (linkedin && company.linkedin === linkedin)) {
        exist = true;
        break;
      }
    }
    if (!exist) {
      let pages = [];
      const customers = await User.getAll();
      for (const customer of customers) {
        if (customer.companies) {
          for (const company of customer.companies) {
            if (company.website) {
              if (company.name === name || (website && company.website.includes(website))) {
                pages.push({ link: company.website, notes: '', last_scan_date: '', jobs: [] });
              }
            }
            if (company.linkedin) {
              if (company.name === name || (linkedin && company.linkedin.includes(linkedin))) {
                pages.push({ link: company.linkedin, notes: '', last_scan_date: '', jobs: [] });
              }
            }
          }
        }
      }

      companies.push({
        name: name,
        website: website,
        linkedin: linkedin,
        pages: pages,
        last_scan_date: '',
        notes: ''
      });
      await User.updateAdmin(companies);

      res.status(201).json({
        success: true,
        message: 'Company added successfully',
        companies,
      });
    }

  } catch (error) {
    console.error('Create error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
);


router.put('/', async (req, res) => {
  const { name, website, linkedin, data } = req.body;
  try {
    // Check if user exists
    const user = await User.getByEmail('admin@evgeny.com');

    let companies = user.companies || [];
    let newcompanies = [];
    for (const company of companies) {
      if (company.name !== data.customer.name && (!data.customer.website || company.website !== data.customer.website) && (!data.customer.linkedin || company.linkedin !== data.customer.linkedin)) {
        newcompanies.push(company);
      } else {
        newcompanies.push({
          name: name,
          website: website,
          linkedin: linkedin,
          pages: company.pages,
          jobs: company.jobs,
          last_scan_date: company.last_scan_date,
          notes: company.notes
        });
      }
    }

    await User.updateAdmin(newcompanies);
    res.status(201).json({
      success: true,
      message: 'Company deleted successfully',
      companies: newcompanies
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
);

// Update scan frequency and openAI API Key
router.put('/scan-config', async (req, res) => {
  const { scan, Key } = req.body;
  try {
    await User.updateScanKey(scan, Key);

    res.status(201).json({
      success: true,
      message: 'Update a Scan and API Key successfully',
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



module.exports = router;
