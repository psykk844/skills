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
      body: body || '',
      level: needsReply ? 'high' : 'low'
    };
  }

  determineIfNeedsReply(body, subject) {
    const text = `${body || ''} ${subject || ''}`.toLowerCase();

    console.log(`[CLASSIFY] Text to analyze: "${text.substring(0, 100)}"`);

    if (this._checkNoReplyPatterns(text)) {
      console.log('[CLASSIFY] ✓ Matched no-reply pattern → NO REPLY');
      return false;
    }

    if (this._checkReplyPatterns(text)) {
      console.log('[CLASSIFY] ✓ Matched reply pattern → REPLY NEEDED');
      return true;
    }

    const hasPersonalContent = text.length > 30 && !this._isAutomated(text);
    if (hasPersonalContent) {
      console.log('[CLASSIFY] ✓ Personal email detected → REPLY NEEDED (default)');
      return true;
    }

    console.log('[CLASSIFY] → NO REPLY (empty or automated)');
    return false;
  }

  _checkNoReplyPatterns(text) {
    if (/no\s+reply\s+needed|no\s+response\s+required|do\s+not\s+reply/.test(text)) {
      return true;
    }

    if (/^(fyi|just letting you know|for your information)[\s:]/.test(text)) {
      return true;
    }

    if (/auto[\\-]?reply|out\s+of\s+office|away|unattended|currently\s+unavailable/.test(text)) {
      return true;
    }

    if (/receipt\s+of|transaction\s+receipt|order\s+confirmation|invoice|statement|tax\s+statement/.test(text)) {
      return true;
    }

    if (/newsletter|notification|digest|subscription|delivery\s+report|bounced|undeliverable/.test(text)) {
      return true;
    }

    if (/^thank\s+you\s+for\s+your\s+email/.test(text) && text.split(' ').length < 15) {
      return true;
    }

    if (/meeting\s+(invitation|request).*(accepted|declined|canceled|cancelled)/i.test(text)) {
      return true;
    }

    if (/invitation\s+(accepted|declined|canceled|cancelled)/i.test(text)) {
      return true;
    }

    return false;
  }

  _checkReplyPatterns(text) {
    if (/\?|what|when|where|who|how|why|which/.test(text)) {
      return true;
    }

    if (/please\s+(let\s+me\s+know|send|provide|confirm|update|review|check|share|forward)/.test(text)) {
      return true;
    }

    if (/could\s+you|would\s+you|can\s+you|would\s+appreciate/.test(text)) {
      return true;
    }

    if (/confirm|verify|approve|authorize|review|sign|initial/.test(text)) {
      return true;
    }

    const acceptedOrDeclined = /accepted|declined|canceled|cancelled/.test(text);
    
    if (!acceptedOrDeclined && /\bmeeting\b/i.test(text)) {
      return true;
    }

    if (!acceptedOrDeclined && /\b(call|discuss|conference|standup)\b/i.test(text)) {
      return true;
    }

    if (/free\s+for|available\s+(?:on|at|this)|what\s+time|which\s+time/.test(text)) {
      return true;
    }

    if (/urgent|asap|immediately|critical|priority|deadline|by\s+when|when\s+can\s+you/.test(text)) {
      return true;
    }

    if (/feedback|opinion|thoughts|suggestions|review|what\s+do\s+you\s+think/.test(text)) {
      return true;
    }

    if (/please\s+review|please\s+confirm|please\s+note/.test(text)) {
      return true;
    }

    return false;
  }

  _isAutomated(text) {
    const automatedPatterns = [
      /auto[\\-]?reply|out\s+of\s+office|away\s+message|vacation\s+message|delivery\s+report|bounced|undeliverable/,
      /no[\\-]?reply[@\\s]|do[\\-]?not[\\-]?reply|noreply|no_reply/,
      /^(fyi|just letting you know|for your information)[\s:]/ 
    ];

    return automatedPatterns.some(pattern => pattern.test(text));
  }
}

module.exports = EmailClassifier;
