const config = require('./config');

class EmailClassifier {
  constructor() {
    this.urgentKeywords = config.importance.urgentKeywords.map(k => k.toLowerCase());
    this.clientDomains = config.importance.clientDomains;
    this.importantSenders = config.importance.importantSenders.map(s => s.toLowerCase());
  }

  classify(email) {
    const { sender, subject, body } = email;

    process.stdout.write(`\n  → Classifying email subject: "${subject?.substring(0, 60) || '(empty)'}"\n`);

    const needsReply = this.determineIfNeedsReply(body, subject);

    return {
      needsReply,
      body
    };
  }

  determineIfNeedsReply(body, subject) {
    const bodyDebug = body ? body.substring(0, 100) : 'NULL';
    const bodyLength = body ? body.length : 0;
    console.log(`    [DEBUG determineIfNeedsReply] body="${bodyDebug}" (length: ${bodyLength}), subject="${subject?.substring(0, 50) || 'NULL'}"`);

    // Indicators that likely need a reply
    const replyIndicators = [
      '?', 'question', 'please', 'could you', 'would you', 
      'can you', 'need', 'require', 'request', 'let me know',
      'confirm', 'verify', 'update', 'urgent', 'asap',
      'your thoughts', 'feedback', 'opinion', 'review',
      'when can', 'by when', 'deadline', 'schedule',
      'call me', 'phone', 'meeting', 'discuss',
      'free for', 'available', 'time', 'accepted', 'meeting'
    ];

    // Indicators that likely don't need a reply
    const noReplyIndicators = [
      'no reply needed', 'no response required', 'for your information',
      'fyi', 'just letting you know', 'auto-reply', 'out of office',
      'thank you for your email', 'receipt', 'confirmation',
      'invoice', 'statement', 'newsletter', 'notification',
      'invitation accepted', 'invitation declined',
      'accepted:', 'declined:', 'cancelled:'
    ];

    let lowerBody = body ? body.toLowerCase() : '';
    let lowerSubject = subject ? subject.toLowerCase() : '';
    let textToCheck = lowerBody + ' ' + lowerSubject;

    console.log(`    [DEBUG] textToCheck="${textToCheck.substring(0, 100)}"`);

    // Check for explicit "no reply needed"
    if (noReplyIndicators.some(indicator => lowerBody.includes(indicator))) {
      console.log(`    [DEBUG] Found noReplyIndicator, returning false`);
      return false;
    }

    // Check for questions or requests
    const foundReplyIndicator = replyIndicators.find(indicator => textToCheck.includes(indicator));
    if (foundReplyIndicator) {
      console.log(`    [DEBUG] Found replyIndicator "${foundReplyIndicator}", returning true`);
      return true;
    }

    console.log(`    [DEBUG] No indicators found, defaulting to true`);
    // Default: if it's a personal email from someone, reply
    return true;
  }
}

module.exports = EmailClassifier;
