require('dotenv').config();
const config = require('./config');
const OutlookNavigator = require('./outlookNavigator');
const EmailClassifier = require('./emailClassifier');
const ReplyDrafter = require('./replyDrafter');

class EmailAgent {
  constructor() {
    this.navigator = new OutlookNavigator();
    this.classifier = new EmailClassifier();
    this.drafter = new ReplyDrafter();
    this.processedEmails = new Set();
  }

  async init() {
    if (!config.openai.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set in .env file');
    }

    if (!config.outlook.email) {
      console.warn('OUTLOOK_EMAIL not set - proceeding with config');
    }

    await this.navigator.init();
  }

  async processEmail(email) {
    const emailKey = `${email.sender}_${email.subject}_${email.date}`;
    
    if (this.processedEmails.has(emailKey)) {
      console.log(`Already processed: ${email.subject}`);
      return null;
    }

    console.log(`\\n--- Processing: ${email.subject} ---`);
    console.log(`From: ${email.sender}`);

    const classification = this.classifier.classify(email);
    console.log(`Needs Reply: ${classification.needsReply ? 'YES (will draft reply)' : 'NO (will skip drafting)'}`);

    if (classification.body && classification.body.trim().length > 0) {
      console.log(`Body preview: ${classification.body.substring(0, 100)}...`);
    } else {
      console.log(`Body: (empty or not extracted)`);
    }

    this.processedEmails.add(emailKey);

    if (!classification.needsReply) {
      console.log('📋 Marked: No reply needed');
      return { email, classification, reply: null };
    }

    console.log('Generating AI reply draft...');
    
    try {
      const reply = await this.drafter.draftReply(email, classification);
      
      console.log('\\nDraft:');
      console.log(reply);
      console.log('\\n---');
      
      console.log('Saving draft to Outlook...');
      const saved = await this.navigator.saveDraft(email, reply);
      
      if (saved) {
        console.log('✅ Draft saved to Outlook Drafts folder');
        return { email, classification, reply };
      } else {
        console.log('❌ Failed to save draft');
        return null;
      }
    } catch (error) {
      console.error(`Error processing email: ${error.message}`);
      return null;
    }
  }

  async checkEmails() {
    console.log(`\\n${'='.repeat(50)}`);
    console.log(`Checking emails at ${new Date().toLocaleTimeString()}`);
    console.log(`${'='.repeat(50)}`);

    try {
      const emails = await this.navigator.getUnreadEmails();
      console.log(`Found ${emails.length} unread emails`);

      for (const email of emails) {
        await this.processEmail(email);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (emails.length === 0) {
        console.log('No new important emails');
      }
    } catch (error) {
      console.error('Error checking emails:', error.message);
    }
  }

  async startMonitoring() {
    console.log('Starting email agent...');
    console.log(`Check interval: ${config.monitoring.checkIntervalMinutes} minutes`);
    
    await this.init();

    await this.navigator.login();

    await this.checkEmails();

    setInterval(async () => {
      try {
        await this.checkEmails();
      } catch (error) {
        console.error('Error in monitoring loop:', error.message);
      }
    }, config.monitoring.checkIntervalMinutes * 60 * 1000);

    console.log('Monitoring emails... Press Ctrl+C to stop');
  }

  async shutdown() {
    console.log('Shutting down...');
    await this.navigator.close();
    process.exit(0);
  }
}

const agent = new EmailAgent();

process.on('SIGINT', () => agent.shutdown());
process.on('SIGTERM', () => agent.shutdown());

agent.startMonitoring().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
