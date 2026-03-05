const OpenAI = require('openai');
const config = require('./config');

class ReplyDrafter {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: 'https://api.siliconflow.cn/v1'
    });
  }

  async draftReply(email, importance) {
    const { sender, subject, body } = email;
    
    const prompt = `You are drafting an email reply. Keep it concise and ${config.reply.tone}.

Original Email:
From: ${sender}
Subject: ${subject}

${body}

Requirements:
1. Acknowledge the sender
2. Address the main points or questions
${importance.level === 'high' ? '3. Address urgency immediately' : ''}
4. Keep it brief (under 150 words)
5. End with "Best regards, [Your Name]"${config.reply.includeOriginal ? '\\n6. Include a brief quote from the original email for context (1-2 sentences max)' : ''}

IMPORTANT: Only provide the email reply text. No explanations, no "Here is a draft", no quotes around the text. Just the email body ready to send.`;

    try {
      console.log(`    Calling AI API with model: ${config.openai.replyModel}`);
      const apiKeyStatus = config.openai.apiKey ? `configured (${config.openai.apiKey.substring(0, 8)}...)` : 'missing';
      console.log(`    API Key: ${apiKeyStatus}`);
      console.log(`    Base URL: https://api.siliconflow.cn/v1`);
      console.log(`    Prompt length: ${prompt.length} chars`);

      const completion = await this.openai.chat.completions.create({
        model: config.openai.replyModel,
        messages: [
          { role: 'system', content: 'You are a helpful email assistant. Draft professional, concise email replies.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      }).catch(err => {
        console.error(`    [ERROR] OpenAI API call failed:`);
        console.error(`    Status: ${err.status}`);
        console.error(`    Message: ${err.message}`);
        console.error(`    Type: ${err.type}`);
        if (err.response) {
          console.error(`    Response data: ${JSON.stringify(err.response.data, null, 2)}`);
        }
        throw err;
      });

      if (!completion || !completion.choices || completion.choices.length === 0) {
        throw new Error('Invalid API response - no choices returned');
      }

      let reply = completion.choices[0].message.content || '';
      reply = reply.trim();

      // Remove markdown formatting if present
      reply = reply.replace(/^"|"$/g, '').replace(/^```.*?```$/gsm, '').trim();

      console.log(`    ✅ AI reply generated (${reply.length} chars)`);
      console.log(`    Preview: ${reply.substring(0, 80)}...`);
      return reply;
    } catch (error) {
      console.error('    ❌ AI API error:', error.message);
      if (error.status === 401) {
        console.error('    ❌ 401 Authentication error - Possible issues:');
        console.error('       - API key is invalid or expired');
        console.error('       - API key format is incorrect');
        console.error('       - Base URL is wrong');
        console.error('    Check your .env file and verify at: https://cloud.siliconflow.cn');
      } else if (error.status === 429) {
        console.error('    ❌ Rate limit exceeded - wait and retry');
      }
      throw new Error(`Failed to generate AI reply: ${error.message}`);
    }
  }
}

module.exports = ReplyDrafter;
