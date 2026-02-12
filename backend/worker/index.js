const cron = require('node-cron');
const moment = require('moment');
const nodemailer = require('nodemailer');

const User = require('../models/User'); // Import the User model
const Company = require('../models/Company'); // Import the Company model
const { parse } = require('path');

const transporter = nodemailer.createTransport({
  pool: true,
  service: "gmail",
  maxConnections: 10,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const sendMail = async (mailOptions) => {
  return transporter.sendMail(mailOptions).then(info => {
    console.log(`${moment().format('DD/MM/YYYY')} - Done, message was sent to `, mailOptions.to);
  }).catch(error => {
    logger(`Error on send EMAIL: `, { error, mailOptions });
    console.error(error);
    console.error(`Message WAS NOT sent to ${mailOptions.to}`);
  })
};

// Found new job at 02:00, 05:00, 08:00, 11:00, 14:00, 17:00, 20:00, 23:00
// runs every 3 hours starting at 02:00
const newJobNotification = cron.schedule('0 2-23/3 * * *', async () => {

  console.log('Finding new job...');
  try {
    // Fetch all customers
    const now = new Date();
    const customers = await User.getAll();
    let totalNewJobs = 0;
    // Iterate through each customer
    let html = '';
    for (const customer of customers) {
      const { id: userId, companies } = customer;
      if (customer.name != 'Benjamin') continue; // For testing purposes
      if (!Array.isArray(companies)) continue;

      // Iterate through each company
      for (const company of companies) {

        let linkedinJobs = [];
        let websiteJobs = [];
        
        for (job of company.jobs) {
          const found = new Date(job.found);
          const diffInHours = Math.abs(now - found) / 36e5; // Convert milliseconds to hours
          if (diffInHours <= 3) {
            const isLinkedIn = job.link && job.link.toLowerCase().includes('linkedin.com');
            if (isLinkedIn) {
              linkedinJobs.push(job);
            } else {
              websiteJobs.push(job);
            }
          }
        }
        
        const companyNewJobsCount = linkedinJobs.length + websiteJobs.length;
        
        if (companyNewJobsCount > 0) {
          let companyContent = `<h1 style='font-size: 30px; margin-bottom: 20px;'>${company.name} - ${companyNewJobsCount} ${companyNewJobsCount > 1 ? 'new positions' : 'new position'}</h1>`;
          
          // Website Jobs Section
          if (websiteJobs.length > 0) {
            companyContent += `<div style='margin-bottom: 30px; padding: 15px; background-color: #f0f8ff; border-left: 4px solid #0066cc;'>`;
            companyContent += `<h2 style='font-size: 24px; margin: 0 0 15px 0; color: #0066cc;'>Website Jobs (${websiteJobs.length})</h2>`;
            websiteJobs.forEach((job, index) => {
              companyContent += `
              <div style="display: flex; align-items: center; margin-bottom: 10px; padding: 10px; background-color: white; border-radius: 5px;">
                <p style='font-size: 18px; margin: 0 20px 0 0; font-weight: bold; color: #333;'>${index + 1}.</p>
                <p style='font-size: 18px; margin: 0 20px 0 0; color: #333; flex: 1;'>${job.title}</p>
                <a href='${job.link}' style='font-size: 16px; color: #0066cc; text-decoration: none;' target='_blank'>View Job →</a>
              </div>`;
            });
            companyContent += `</div>`;
          }
          
          // LinkedIn Jobs Section
          if (linkedinJobs.length > 0) {
            companyContent += `<div style='margin-bottom: 30px; padding: 15px; background-color: #f0f7ff; border-left: 4px solid #0077b5;'>`;
            companyContent += `<h2 style='font-size: 24px; margin: 0 0 15px 0; color: #0077b5;'>LinkedIn Jobs (${linkedinJobs.length})</h2>`;
            linkedinJobs.forEach((job, index) => {
              companyContent += `
              <div style="display: flex; align-items: center; margin-bottom: 10px; padding: 10px; background-color: white; border-radius: 5px;">
                <p style='font-size: 18px; margin: 0 20px 0 0; font-weight: bold; color: #333;'>${index + 1}.</p>
                <p style='font-size: 18px; margin: 0 20px 0 0; color: #333; flex: 1;'>${job.title}</p>
                <a href='${job.link}' style='font-size: 16px; color: #0077b5; text-decoration: none;' target='_blank'>View Job →</a>
              </div>`;
            });
            companyContent += `</div>`;
          }
          
          html += companyContent;
        }
        totalNewJobs += companyNewJobsCount;
      }
    }

    // console.log('Total new jobs found:', totalNewJobs);
    // console.log('HTML content:', html);

    if (totalNewJobs > 0) {
      ['lee@itsoft.co.il', 'evgeny@commit-offshore.com', 'tal@savannahtech.io', 'nguyen.vc.2201@gmail.com'].map(email => {
        const mailOptions = {
          from: { address: process.env.GMAIL_USER, name: "Commit Offshore Notifications" },
          to: email,
          subject: totalNewJobs > 1 ? "New positions found for monitored customers" : "New position found for monitored customers",
          html
        };
        sendMail(mailOptions);
      });
    }
    console.log('Periodic scan task completed.');
  } catch (error) {
    console.error('Error during periodic scan task:', error.message);
  }
});

// // Schedule a task to run every 12 hours
const periodicScan = cron.schedule('0 */12 * * *', async () => {
  console.log('Running periodic scan task...');
  try {
    // Fetch all customers
    const customers = await User.getAll();

    // Iterate through each customer
    for (const customer of customers) {
      const { id: userId, companies } = customer;
      if (customer.name != 'Benjamin') continue; // For testing purposes
      if (!Array.isArray(companies)) continue;

      // Iterate through each company
      for (const company of companies) {
        const { last_scan_date, id: companyId, period } = company;

        // Check if the company needs to be scanned based on scanFrequency
        const now = new Date();
        const lastScan = last_scan_date ? new Date(last_scan_date) : null;
        if (period.at(-1) === 'h') {
          // Calculate the next scan time
          const frequencyInMs = parseInt(period) * 36e5; // Convert period to milliseconds

          if (!lastScan || now - lastScan >= frequencyInMs) {
            // console.log(`Scanning company ${company.name} for user ${userId}...`);
            const res = await Company.scanCompany({ id: userId, companyId: companyId });
            // console.log(`Scan result for company ${company.name}:`, res);
          }
        }
      }
    }

    console.log('Periodic scan task completed.');
  } catch (error) {
    console.error('Error during periodic scan task:', error.message);
  }
});

const croneExecutor = () => {
  periodicScan.start();
  newJobNotification.start();
}

module.exports = { croneExecutor }
