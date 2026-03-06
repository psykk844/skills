const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');

class ReplyDrafter {
  constructor() {
    if (!config.openai.apiKey || config.openai.apiKey.trim() === '') {
      throw new Error('[INIT ERROR] ANTHROPIC_API_KEY is empty in .env file');
    }

    this.anthropic = new Anthropic({
      apiKey: config.openai.apiKey.trim(),
    });

    this.maxRetries = 4;
    this.retryDelayMs = 15000; // 15s base — gives token-per-minute window time to refill
  }

  async _callWithRetry(fn, retryCount = 0) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && retryCount < this.maxRetries) {
        const delayMs = this.retryDelayMs * Math.pow(2, retryCount);
        console.log(`[RETRY] Rate limited. Waiting ${delayMs}ms... (attempt ${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return this._callWithRetry(fn, retryCount + 1);
      }
      throw error;
    }
  }

  _cleanBody(body) {
    if (!body) return '(No body content)';
    // Strip Outlook UI chrome that gets mixed into innerText
    return body
      .replace(/^Summarise\n/gm, '')
      .replace(/^Reply\n/gm, '')
      .replace(/^Reply all\n/gm, '')
      .replace(/^Forward\n/gm, '')
      .replace(/^Like\n/gm, '')
      .replace(/Book time to meet with me\n?/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  _senderFirstName(sender) {
    // sender is typically "Firstname Lastname" or "Firstname.Lastname@domain.com"
    const name = sender.split(/[@.<]/)[0].trim();
    return name.split(/\s+/)[0] || sender;
  }

  async draftReply(email, importance) {
    const { sender, subject, body } = email;
    // Cap body at 800 chars to stay well within token budget
    const cleanedBody = this._cleanBody(body).substring(0, 800);
    const firstName = this._senderFirstName(sender);
    const myFirstName = (config.outlook.email.split('.')[0] || 'Felicia');

    // System prompt kept separate so it isn't counted twice in the user turn
    const systemPrompt = `You draft short email replies for ${myFirstName}. Tone: ${config.reply.tone}. Reply only with the plain email text — no markdown, no explanations, under 120 words.`;

    const userPrompt = `From: ${sender}
Subject: ${subject}
---
${cleanedBody}
---
Reply addressing ${firstName} by first name. Sign off as ${myFirstName}. No placeholders like "[Your Name]".`;

    try {
      console.log(`[API] Calling Anthropic with model: ${config.openai.replyModel}`);

      const completion = await this._callWithRetry(
        async () => this.anthropic.messages.create({
          model: config.openai.replyModel,
          max_tokens: 300,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt
            }
          ]
        })
      ).catch(error => {
        if (error.status === 401) {
          throw new Error(
            '[AUTH ERROR] Invalid Anthropic API key. Check ANTHROPIC_API_KEY in .env file.'
          );
        } else if (error.status === 429) {
          throw new Error(
            '[RATE LIMIT] Too many requests. Anthropic quota exceeded.'
          );
        } else if (error.status >= 500) {
          throw new Error(
            '[SERVER ERROR] Anthropic API temporarily unavailable.'
          );
        }
        throw error;
      });

      if (!completion?.content?.[0]?.text) {
        throw new Error('Invalid API response - no content returned');
      }

      let reply = completion.content[0].text.trim();
      reply = reply.replace(/^```[\s\S]*?```$/gm, '').trim();

      const usage = completion.usage || {};
      console.log(`[API] ✅ Reply generated (${reply.length} chars) | tokens: ${usage.input_tokens || '?'} in / ${usage.output_tokens || '?'} out`);
      return reply;

    } catch (error) {
      console.error(`[DRAFT ERROR] ${error.message}`);
      throw new Error(
        `Failed to draft reply for "${subject}": ${error.message}`
      );
    }
  }
}

module.exports = ReplyDrafter;
