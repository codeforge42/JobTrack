
const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

class Classifier {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey
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
      threshold = 0.8
    } = options;

    try {
      // Construct prompt for GPT-4
      const prompt = customPrompt || 
        "Determine if this job posting is for a technical role. A technical role requires programming, software development, IT, data science, engineering, deploying, or Telecomunication similar technical skills including technical leader. Output TECHNICAL if it is technical, NON-TECHNICAL if not.";
      
      const jobText = `Job Title: ${title}\nCompany: ${company || 'Not specified'}\nJob Description: ${description}`;
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: jobText }
        ],
        temperature: 0.3
      });

      // Extract the response
      const response = completion.choices[0].message.content.trim();
      
      return response;
    } catch (error) {
      console.error('Classification error:', error.message);
      throw error;
    }
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
