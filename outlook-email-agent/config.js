require('dotenv').config();

const config = {
  openai: {
    apiKey: process.env.SILICONFLOW_API_KEY || '',
    model: 'Qwen/Qwen2.5-7B-Instruct',  // Alternative model via SiliconFlow
    replyModel: 'Qwen/Qwen2.5-7B-Instruct'  // For generating replies
  },
  
  outlook: {
    email: process.env.OUTLOOK_EMAIL || '',
    url: 'https://outlook.cloud.microsoft',
    headless: false,  // Visible mode for debugging
  },
  
  monitoring: {
    checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES) || 10,
    maxEmailsPerCheck: 10,
    checkUnreadOnly: false  // Process all emails for testing
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
