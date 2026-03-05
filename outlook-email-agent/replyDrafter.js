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

    this.maxRetries = 3;
    this.retryDelayMs = 1000;
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

  async draftReply(email, importance) {
    const { sender, subject, body } = email;

    const prompt = `You are drafting an email reply. Keep it concise and ${config.reply.tone}.

Original Email:
From: ${sender}
Subject: ${subject}

Body:
${body || '(No body content)'}

Requirements:
1. Acknowledge the sender
2. Address the main points or questions
${importance.level === 'high' ? '3. Address urgency immediately\n' : ''}4. Keep it brief (under 150 words)
5. End with professional closing

IMPORTANT: Only provide the email reply text. No explanations, no markdown, no quotes. Just the email body.`;

    try {
      console.log(`[API] Calling Anthropic with model: ${config.openai.replyModel}`);
      const apiKeyPreview = config.openai.apiKey.substring(0, 10) + '...';
      console.log(`[API] Key: ${apiKeyPreview}`);

      const completion = await this._callWithRetry(
        async () => this.anthropic.messages.create({
          model: config.openai.replyModel,
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `You are a helpful email assistant that drafts professional, concise email replies.\n\n${prompt}`
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

      console.log(`[API] ✅ Reply generated (${reply.length} chars)`);
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
