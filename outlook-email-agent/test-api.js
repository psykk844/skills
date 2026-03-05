require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

async function testAPI() {
  console.log('=== Testing Anthropic API ===\n');
  console.log(`API Key: ${process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
  console.log(`Model: ${require('./config').openai.replyModel}\n`);

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    console.log('Sending test request...');
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      messages: [
        { role: 'user', content: 'Say "API test successful" in one sentence.' }
      ]
    });

    console.log('✅ API call successful!');
    console.log(`Response: ${response.content[0].text}`);
    console.log(`\nAPI Status: ✅ Working`);
  } catch (error) {
    console.log('❌ API call failed!');
    console.log(`Error: ${error.message}`);
    console.log(`Status: ${error.status}`);
    console.log(`Type: ${error.type}`);
    if (error.error) {
      console.log(`Details: ${JSON.stringify(error.error)}`);
    }
  }
}

testAPI().catch(console.error);
