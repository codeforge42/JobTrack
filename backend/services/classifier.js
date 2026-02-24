
const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

class Classifier {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format. Key should start with "sk-"');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey,
      timeout: 30000,  // 30 second timeout
      maxRetries: 2,   // Built-in retry attempts
    });
  }

  /**
   * Classify a job posting as technical or non-technical using OpenAI's GPT-4
   * @param {Object} jobPosting - Job posting object with title and description
   * @param {Object} options - Classification options
   * @returns {Object} - Classification result
   */
  async classifyJobPosting(jobPosting, options = {}) {
    const { title, description, company } = jobPosting;
    const {
      customPrompt,
      threshold = 0.8,
      maxRetries = 3,
    } = options;

    const prompt = customPrompt || 
      "Determine if this job posting is for a technical role. A technical role requires programming, software development, IT, data science, engineering, deploying, or Telecomunication similar technical skills including technical leader. Output TECHNICAL if it is technical, NON-TECHNICAL if not.";
    
    const jobText = `Job Title: ${title}\nCompany: ${company || 'Not specified'}\nJob Description: ${description}`;

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: jobText }
          ],
          temperature: 0.3,
          timeout: 30000,
        });

        // Extract the response
        const response = completion.choices[0].message.content.trim();
        return response;
      } catch (error) {
        lastError = error;
        const isConnectionError = error.code === 'ECONNREFUSED' || 
                                 error.code === 'ETIMEDOUT' || 
                                 error.code === 'ENOTFOUND' ||
                                 error.status === 401 ||
                                 error.status === 429 ||
                                 error.message?.includes('Connection') ||
                                 error.message?.includes('timeout');

        console.warn(`Classification attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        if (isConnectionError && attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (attempt === maxRetries) {
          console.error(`Failed to classify after ${maxRetries} attempts. Last error:`, {
            status: error.status,
            code: error.code,
            message: error.message,
            type: error.type,
          });
          throw error;
        }
      }
    }

    throw lastError;
  }
  
  /**
   * Extract confidence level from AI response if present
   * @param {string} response - AI response string
   * @returns {number|null} - Confidence level or null if not found
   */
  extractConfidence(response) {
    const confidenceMatch = response.match(/confidence:?\s*(\d+(?:\.\d+)?)%?/i);
    if (confidenceMatch && confidenceMatch[1]) {
      let confidence = parseFloat(confidenceMatch[1]);
      // Convert percentage to decimal if needed
      if (confidence > 1) {
        confidence = confidence / 100;
      }
      return confidence;
    }
    return null;
  }
}

module.exports = Classifier;
