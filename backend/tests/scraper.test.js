
const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const nock = require('nock');
const sinon = require('sinon');
const puppeteer = require('puppeteer');
const Scraper = require('../services/scraper');

describe('Scraper Service', () => {
  describe('scrapeStatic', () => {
    beforeEach(() => {
      nock.disableNetConnect();
    });
    
    afterEach(() => {
      nock.cleanAll();
      nock.enableNetConnect();
    });
    
    it('should scrape jobs from a static page', async () => {
      // Mock HTML content
      const mockHtml = `
        <div class="job-card">
          <h3 class="job-title">Software Engineer</h3>
          <div class="company">Tech Co</div>
          <div class="location">San Francisco, CA</div>
          <div class="description">We're looking for a talented developer</div>
          <a href="/jobs/123">Apply</a>
          <span class="date">2 days ago</span>
        </div>
        <div class="job-card">
          <h3 class="job-title">Product Manager</h3>
          <div class="company">Product Inc</div>
          <div class="location">Remote</div>
          <div class="description">Lead our product team</div>
          <a href="/jobs/456">Apply</a>
          <span class="date">1 week ago</span>
        </div>
      `;
      
      // Setup nock to mock HTTP request
      nock('https://example.com')
        .get('/jobs')
        .reply(200, mockHtml);
      
      // Define selectors
      const selectors = {
        jobCard: '.job-card',
        title: '.job-title',
        company: '.company',
        location: '.location',
        description: '.description',
        url: 'a',
        postedDate: '.date'
      };
      
      // Call the scraper
      const jobs = await Scraper.scrapeStatic('https://example.com/jobs', selectors);
      
      // Assertions
      expect(jobs).to.be.an('array');
      expect(jobs.length).to.equal(2);
      expect(jobs[0].title).to.equal('Software Engineer');
      expect(jobs[0].company).to.equal('Tech Co');
      expect(jobs[1].title).to.equal('Product Manager');
      expect(jobs[1].company).to.equal('Product Inc');
    });
    
    it('should handle errors gracefully', async () => {
      // Setup nock to mock a failed request
      nock('https://example.com')
        .get('/jobs')
        .replyWithError('Connection refused');
      
      try {
        await Scraper.scrapeStatic('https://example.com/jobs', {});
        // Should not reach here
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
  
  describe('scrapeDynamic', () => {
    let browserStub;
    let pageStub;
    
    beforeEach(() => {
      // Create stubs for puppeteer browser and page
      pageStub = {
        goto: sinon.stub().resolves(),
        waitForSelector: sinon.stub().resolves(),
        evaluate: sinon.stub().resolves([
          {
            title: 'Frontend Developer',
            company: 'Web Co',
            location: 'New York, NY',
            description: 'Build amazing web interfaces',
            url: 'https://example.com/jobs/789',
            postedDate: '3 days ago',
            scrapedAt: sinon.match.string
          }
        ]),
        close: sinon.stub().resolves()
      };
      
      browserStub = {
        newPage: sinon.stub().resolves(pageStub),
        close: sinon.stub().resolves()
      };
      
      sinon.stub(puppeteer, 'launch').resolves(browserStub);
    });
    
    afterEach(() => {
      sinon.restore();
    });
    
    it('should scrape jobs from a dynamic page', async () => {
      const selectors = {
        jobCard: '.job-listing',
        title: '.job-title',
        company: '.company-name'
      };
      
      const jobs = await Scraper.scrapeDynamic('https://example.com/dynamic-jobs', selectors);
      
      expect(jobs).to.be.an('array');
      expect(jobs.length).to.equal(1);
      expect(jobs[0].title).to.equal('Frontend Developer');
      expect(jobs[0].company).to.equal('Web Co');
      
      // Verify puppeteer was called correctly
      expect(puppeteer.launch.calledOnce).to.be.true;
      expect(browserStub.newPage.calledOnce).to.be.true;
      expect(pageStub.goto.calledWith('https://example.com/dynamic-jobs')).to.be.true;
      expect(browserStub.close.calledOnce).to.be.true;
    });
    
    it('should handle puppeteer errors', async () => {
      // Make page.goto throw an error
      pageStub.goto.rejects(new Error('Navigation timeout'));
      
      try {
        await Scraper.scrapeDynamic('https://example.com/slow-page', {});
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include('Dynamic scraping error');
        // Verify browser was closed even after error
        expect(browserStub.close.calledOnce).to.be.true;
      }
    });
  });
  
  describe('scrape', () => {
    it('should use dynamic scraping when specified', async () => {
      // Stub the scrapeDynamic method
      sinon.stub(Scraper, 'scrapeDynamic').resolves([]);
      sinon.stub(Scraper, 'scrapeStatic').resolves([]);
      
      const jobSource = {
        url: 'https://example.com/jobs',
        scraping_method: 'dynamic',
        selector_config: {
          jobCard: '.job'
        }
      };
      
      await Scraper.scrape(jobSource);
      
      expect(Scraper.scrapeDynamic.calledOnce).to.be.true;
      expect(Scraper.scrapeStatic.called).to.be.false;
      
      Scraper.scrapeDynamic.restore();
      Scraper.scrapeStatic.restore();
    });
    
    it('should use static scraping by default', async () => {
      // Stub the scrapeStatic method
      sinon.stub(Scraper, 'scrapeDynamic').resolves([]);
      sinon.stub(Scraper, 'scrapeStatic').resolves([]);
      
      const jobSource = {
        url: 'https://example.com/jobs',
        scraping_method: 'static',
        selector_config: {
          jobCard: '.job'
        }
      };
      
      await Scraper.scrape(jobSource);
      
      expect(Scraper.scrapeStatic.calledOnce).to.be.true;
      expect(Scraper.scrapeDynamic.called).to.be.false;
      
      Scraper.scrapeDynamic.restore();
      Scraper.scrapeStatic.restore();
    });
  });
});
