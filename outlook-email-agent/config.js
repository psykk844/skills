require('dotenv').config();

const config = {
  openai: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    baseAPI: 'anthropic',
    model: 'claude-3-haiku-20240307',  // Fast model for classification
    replyModel: 'claude-3-5-haiku-20241022'  // Testing: cheaper model for drafting to stay within 30k TPM
  },
  
  outlook: {
    email: process.env.OUTLOOK_EMAIL || '',
    url: 'https://outlook.cloud.microsoft',
    headless: false,  // Visible mode for debugging
  },
  
  monitoring: {
    checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES) || 10,
    maxEmailsPerCheck: 3,
    checkUnreadOnly: true  // Only process unread emails to avoid redundant API calls
  },
  
  importance: {
    urgentKeywords: ['urgent', 'asap', 'immediately', 'deadline', 'critical', 'emergency', 'important', 'priority'],
    clientDomains: [],  // Add client email domains here
    importantSenders: [],  // Add specific email addresses
    maxAgeHours: 48  // Only consider emails from last 48 hours
  },
  
  reply: {
    tone: 'professional yet friendly',
    includeOriginal: true,  // Include original email in reply
    signature: '\\n\\nBest regards,\\n[Your Name]'
  }
};

module.exports = config;
