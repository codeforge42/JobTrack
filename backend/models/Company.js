
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const Scraper = require('../services/scraper.js');
const Classifier = require('../services/classifier.js');
const crypto = require('crypto');
const User = require('./User.js');

class Company {
  
  static async getCompanyById(id) {
    try {
      const result = await pool.query(
        'SELECT companies FROM users WHERE id = $1',
        [id]
      );
      return result.rows.length ? result.rows[0].companies : null;
    } catch (error) {
      console.error('Error finding user by id:', error.message);
      throw error;
    }
  }

  static async updateCompany(addData) {
    const { id, companies } = addData;
  
    try {

      // Update user into database
      const result = await pool.query(
        'UPDATE users SET companies = $1::jsonb WHERE id = $2 RETURNING id, name, email, companies',
        [JSON.stringify(companies), id]
      );
  
      return result.rows[0]; // Return the newly created user
    } catch (error) {
      console.error('Error creating user:', error.message);
      throw error;
    }
  }

  static async scanCompany(scanData) {

    const { id, companyId, scanTypes = ['website', 'linkedin'] } = scanData;

    // Check if user exists
    let companies;

    try {
      const result = await pool.query(
        'SELECT companies FROM users WHERE id = $1',
        [id]
      );
      companies = result.rows.length ? result.rows[0].companies : [];
    } catch (error) {
      console.error('Error finding user by id:', error.message);
      throw error;
    }
    const apiKey = process.env.OPENAI_API_KEY || '';
    const Classifier_Obj = new Classifier(apiKey);
    let classified_jobList = [], WebsitejobList = [], LinkedinjobList = [], jobList = [], jobRemoved = [];
    const options = {
      customPrompt:
        'Analyze the following job posting. Does it describe a technical position like Software, Architect, Developer, QA, AQA, or DevOps,  programming, IT, data science, engineering, deploying, or Telecomunication similar technical skills including technical leader, IT Helpdesk? If yes, return a short explanation; if not, respond with "No match". Enterprise Account Manager, Business Development Representative arenot technical',
    };
    let result;
    for (const company of companies) {
      if (company.id.includes(companyId)) {
        // Await the Scraper function
        let websitelinks = [], linkedinlinks = [];
        company.jobs.map(job => {
          // if (job.link && job.link.includes('linkedin.com')) linkedinlinks.push(job.link);
          // else if (job.link) 
          websitelinks.push(job.link);
        });
        // if (company.website.toLowerCase().includes("spikerz")) websitelinks = linkedinlinks;
        // Scan website only if website is in scanTypes
        if (scanTypes.includes('website')) {
          WebsitejobList = await Scraper(company.name, company.website, apiKey, 1, websitelinks, company.selector);
          // if (WebsitejobList.found != 1) {
          //   let jobRemovedForPartlist = websitelinks;
          //   if (JSON.parse(WebsitejobList.matches).length > 0) {
          //     let Jobs = [], PartList, Joblinks = [];
          //     for (const url of JSON.parse(WebsitejobList.matches)) {
          //       PartList = await Scraper(company.name, url, apiKey, 2, websitelinks);
    
          //       JSON.parse(PartList.jobs).map(job => {
          //         if (Joblinks.filter(j => j == job.link).length == 0) {
          //           Jobs.push(job);
          //           Joblinks.push(job.link);
          //         }
          //       });
          //       jobRemovedForPartlist = jobRemovedForPartlist.filter(l => !JSON.parse(PartList.removed || '[]').some(r => r == l));
          //     }
          //     WebsitejobList = { found: 1, jobs: JSON.stringify(Jobs), removed: JSON.stringify(jobRemovedForPartlist)};
          //   }
          // }
        } else {
          // If website scan is not selected, set empty results
          WebsitejobList = { jobs: '[]', removed: '[]' };
        }
        
        // Scan LinkedIn only if linkedin is in scanTypes
        // if (scanTypes.includes('linkedin')) {
        //   LinkedinjobList = await Scraper(company.name, company.linkedin, apiKey, 2, linkedinlinks);
        // } else {
        //   // If LinkedIn scan is not selected, set empty results
        //   LinkedinjobList = { jobs: '[]', removed: '[]' };
        // }
    
        jobList = [...JSON.parse(WebsitejobList.jobs || '[]'), ...JSON.parse(LinkedinjobList.jobs || '[]')];
        jobRemoved = [...JSON.parse(WebsitejobList.removed || '[]'), ...JSON.parse(LinkedinjobList.removed || '[]')];
        
        const now  = new Date();
        classified_jobList = [];
        for (const job of jobList) {
          if (!job.link) continue;
          // const jobPosting = {
          //   title: job.title,
          //   company: company.name,
          //   description: ''
          // };
          if (apiKey) {
            // const result = await Classifier_Obj.classifyJobPosting(jobPosting, options);
            classified_jobList.push({
              id: crypto.randomBytes(16).toString('hex'),
              title: job.title,
              description: "",
              link: job.link,
              found: now
            });
          } else {
            classified_jobList.push({
              id: crypto.randomBytes(16).toString('hex'),
              title: job.title,
              description: job.detail,
              link: job.link,
              found: now
            });
          }
        }
    
        console.log('classifying completed');
        const left = company.jobs.filter(j => !jobRemoved.some(r => r == j.link));
        console.log('left', left);
        company.jobs = [...left, ...classified_jobList];
        company.last_scan_date = now.toISOString();
        result = company;
      }
    }
    
    // Update the database after processing all companies
    await pool.query(
      'UPDATE users SET companies = $1::jsonb WHERE id = $2',
      [JSON.stringify(companies), id]
    );
    if (companyId) return result;
    else return companies;
  }
  
  static async deleteRecord(deleteData) {

    const { id, companyId, sourceType } = deleteData;

    // Check if user exists
    let companies;

    try {
      const result = await pool.query(
        'SELECT companies FROM users WHERE id = $1',
        [id]
      );
      companies = result.rows.length ? result.rows[0].companies : [];
    } catch (error) {
      console.error('Error finding user by id:', error.message);
      throw error;
    }
    for (const company of companies) {
      if (company.id.includes(companyId)) {
        // If sourceType is provided, filter jobs by source type
        if (sourceType) {
          if (sourceType === 'website') {
            // Delete website jobs, keep LinkedIn jobs
            company.jobs = company.jobs.filter(job => 
              job.link && job.link.toLowerCase().includes('linkedin.com')
            );
          } else if (sourceType === 'linkedin') {
            // Delete LinkedIn jobs, keep website jobs
            company.jobs = company.jobs.filter(job => 
              !job.link || !job.link.toLowerCase().includes('linkedin.com')
            );
          }
        } else {
          // If no sourceType, delete all jobs (backward compatibility)
          company.jobs = [];
          company.last_scan_date = null;
        }
        
        // Set last_scan_date to null only if all jobs are deleted
        if (company.jobs.length === 0) {
          company.last_scan_date = null;
        }
      }
    }
    
    // Update the database after processing all companies
    await pool.query(
      'UPDATE users SET companies = $1::jsonb WHERE id = $2',
      [JSON.stringify(companies), id]
    );
    if (companyId) return 'Company record deleted successfully';
    else return 'All records deleted successfully';
  }
}

module.exports = Company;
