const config = require('./config');

class EmailClassifier {
  constructor() {
    this.urgentKeywords = config.importance.urgentKeywords.map(k =>
      k.toLowerCase()
    );
    this.clientDomains = config.importance.clientDomains;
    this.importantSenders = config.importance.importantSenders.map(s =>
      s.toLowerCase()
    );
  }

  classify(email) {
    const { sender, subject, body } = email;

    process.stdout.write(
      `\n → Classifying: "${subject?.substring(0, 60) || '(empty)'}" from ${
        sender || 'unknown'
      }\n`
    );

    const needsReply = this.determineIfNeedsReply(body, subject);

    return {
      needsReply,
      body: body || '',
      level: needsReply ? 'high' : 'low'
    };
  }

  determineIfNeedsReply(body, subject) {
    const text = `${body || ''} ${subject || ''}`.toLowerCase();
    console.log(
      `[CLASSIFY] Analyzing: "${text.substring(0, 100).replace(/\n/g, ' ')}..."`
    );

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
      console.log('[CLASSIFY] ✓ Personal email detected → REPLY NEEDED');
      return true;
    }

    console.log('[CLASSIFY] → NO REPLY (empty or automated)');
    return false;
  }

  _checkNoReplyPatterns(text) {
    const noReplyPatterns = [
      /no\s+reply\s+needed/i,
      /no\s+response\s+required/i,
      /do\s+not\s+reply/i,
      /fyi[\s:]/i,
      /for\s+your\s+information[\s:]/i,
      /auto[\s-]?reply/i,
      /out\s+of\s+office/i,
      /away[\s:]?(message|status)?/i,
      /receipt\s+of/i,
      /transaction\s+receipt/i,
      /order\s+confirmation/i,
      /invoice/i,
      /receipt/i,
      /tax\s+statement/i,
      /newsletter/i,
      /notification/i,
      /digest/i,
      /subscription/i,
      /delivery\s+report/i,
      /bounced\s+email/i,
      /undeliverable/i,
      /^thank\s+you\s+for\s+your\s+email/i,
      /meeting\s+(invitation|request).*?(accepted|declined|canceled|cancelled)/i,
      /invitation.*?(accepted|declined|canceled|cancelled)/i
    ];

    return noReplyPatterns.some(pattern => pattern.test(text));
  }

  _checkReplyPatterns(text) {
    const replyPatterns = [
      /\?/,
      /what|when|where|who|how|why|which/i,
      /please\s+(let\s+me\s+know|send|provide|confirm|update|review|check|share)/i,
      /could\s+you|would\s+you|can\s+you|will\s+you/i,
      /would\s+appreciate/i,
      /confirm|verify|approve|authorize|review|sign/i,
      /\bmeeting\b.*?(?!declined|canceled|cancelled)/i,
      /call|discuss|conference|standup/i,
      /free\s+for|available\s+(?:on|at|this)/i,
      /what\s+time|which\s+time|when\s+can\s+you/i,
      /urgent|asap|immediately|critical|priority|deadline/i,
      /feedback|opinion|thoughts|suggestions|review/i,
      /what\s+do\s+you\s+think/i,
      /please\s+review|please\s+confirm|please\s+note|please\s+see/i
    ];

    return replyPatterns.some(pattern => pattern.test(text));
  }

  _isAutomated(text) {
    const automatedPatterns = [
      /auto[\s-]?reply/i,
      /out\s+of\s+office/i,
      /vacation\s+message/i,
      /delivery\s+report/i,
      /undeliverable/i,
      /noreply|no[\s-]?reply[\s:]@/i,
      /fyi[\s:]/i,
      /just\s+letting\s+you\s+know/i
    ];

    return automatedPatterns.some(pattern => pattern.test(text));
  }
}

module.exports = EmailClassifier;
