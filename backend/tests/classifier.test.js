
const { describe, it } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const { OpenAI } = require('openai');
const Classifier = require('../services/classifier');

describe('Classifier Service', () => {
  describe('classifyJobPosting', () => {
    let classifier;
    let openaiStub;
    
    beforeEach(() => {
      classifier = new Classifier();
      
      // Stub the OpenAI create method
      openaiStub = sinon.stub(classifier.openai.chat.completions, 'create');
    });
    
    afterEach(() => {
      openaiStub.restore();
    });
    
    it('should classify a job posting as technical', async () => {
      // Mock OpenAI response for a technical job
      openaiStub.resolves({
        choices: [
          {
            message: {
              content: 'TECHNICAL - This is clearly a technical role requiring programming skills.'
            }
          }
        ]
      });
      
      const jobPosting = {
        id: 1,
        title: 'Software Engineer',
        company: 'Tech Co',
        description: 'Need experience with JavaScript, Node.js, and React.'
      };
      
      const result = await classifier.classifyJobPosting(jobPosting);
      
      expect(result).to.be.an('object');
      expect(result.jobId).to.equal(1);
      expect(result.classification).to.equal('technical');
      expect(result.confidence).to.be.a('number');
      expect(result.rawResponse).to.include('TECHNICAL');
      expect(openaiStub.calledOnce).to.be.true;
    });
    
    it('should classify a job posting as non-technical', async () => {
      // Mock OpenAI response for a non-technical job
      openaiStub.resolves({
        choices: [
          {
            message: {
              content: 'NON-TECHNICAL - This is a marketing position with no technical requirements.'
            }
          }
        ]
      });
      
      const jobPosting = {
        id: 2,
        title: 'Marketing Manager',
        company: 'Marketing Inc',
        description: 'Lead our marketing efforts and campaigns.'
      };
      
      const result = await classifier.classifyJobPosting(jobPosting);
      
      expect(result).to.be.an('object');
      expect(result.jobId).to.equal(2);
      expect(result.classification).to.equal('non-technical');
      expect(openaiStub.calledOnce).to.be.true;
    });
    
    it('should handle ambiguous responses', async () => {
      // Mock OpenAI response with ambiguous content
      openaiStub.resolves({
        choices: [
          {
            message: {
              content: 'This role has some technical aspects but is primarily management.'
            }
          }
        ]
      });
      
      const jobPosting = {
        id: 3,
        title: 'IT Project Manager',
        company: 'Corp Inc',
        description: 'Manage IT projects, technical background preferred.'
      };
      
      const result = await classifier.classifyJobPosting(jobPosting);
      
      expect(result).to.be.an('object');
      expect(result.classification).to.equal('unknown');
      expect(result.confidence).to.equal(0.5);
      expect(openaiStub.calledOnce).to.be.true;
    });
    
    it('should use custom prompt when provided', async () => {
      // Setup stub
      openaiStub.resolves({
        choices: [
          {
            message: {
              content: 'TECHNICAL'
            }
          }
        ]
      });
      
      const jobPosting = {
        title: 'Developer',
        description: 'Code things'
      };
      
      const customPrompt = 'Custom classification instructions';
      
      await classifier.classifyJobPosting(jobPosting, { customPrompt });
      
      // Verify the custom prompt was used
      expect(openaiStub.calledOnce).to.be.true;
      const call = openaiStub.getCall(0);
      expect(call.args[0].messages[0].content).to.equal(customPrompt);
    });
    
    it('should apply confidence threshold correctly', async () => {
      // Mock OpenAI response with confidence indication
      openaiStub.resolves({
        choices: [
          {
            message: {
              content: 'TECHNICAL (confidence: 65%)'
            }
          }
        ]
      });
      
      const jobPosting = {
        title: 'Systems Analyst',
        description: 'Analyze IT systems'
      };
      
      // Set threshold higher than the confidence
      const result = await classifier.classifyJobPosting(jobPosting, { threshold: 0.7 });
      
      // Should mark as needs review since confidence (0.65) < threshold (0.7)
      expect(result.classification).to.equal('needs-review');
      expect(result.confidence).to.equal(0.65);
    });
    
    it('should extract confidence from response', () => {
      const response1 = 'TECHNICAL with confidence: 85%';
      const confidence1 = classifier.extractConfidence(response1);
      expect(confidence1).to.equal(0.85);
      
      const response2 = 'NON-TECHNICAL (confidence 0.72)';
      const confidence2 = classifier.extractConfidence(response2);
      expect(confidence2).to.equal(0.72);
      
      const response3 = 'Just a plain response';
      const confidence3 = classifier.extractConfidence(response3);
      expect(confidence3).to.be.null;
    });
  });
});
