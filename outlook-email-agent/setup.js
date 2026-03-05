require('dotenv').config();
const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');

async function setupOutlook() {
  console.log('=== Outlook Email Agent Setup ===\\n');
  console.log('This will help you log into Outlook for the first time.');
  console.log('After successful login, your session will be saved locally.\\n');

  const userDir = path.join(__dirname, 'playwright-profile');

  console.log('Launching browser...');
  const browser = await chromium.launchPersistentContext(userDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = browser.pages()[0] || await browser.newPage();

  await page.goto(config.outlook.url, { waitUntil: 'networkidle' });

  console.log('\\n✓ Browser opened');
  console.log('\\nINSTRUCTIONS:');
  console.log('1. Log in to your Outlook account');
  console.log('2. If prompted, grant any necessary permissions');
  console.log('3. Wait until you see your inbox');
  console.log('4. Type "done" in this terminal to save the session and exit.\\n');

  const lineReader = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  lineReader.question('Type "done" when you have logged in and can see your inbox: ', (answer) => {
    if (answer.toLowerCase().trim() === 'done') {
      console.log('\\n✓ Session saved!');
      console.log('\\nYou can now run the email agent with: node main.js');
      console.log('Your login session will be persisted automatically.\\n');
      
      browser.close();
      lineReader.close();
      process.exit(0);
    } else {
      console.log('Type "done" when ready');
    }
  });

  browser.on('disconnected', () => {
    console.log('\\nBrowser closed unexpectedly. Please try again.');
    lineReader.close();
    process.exit(1);
  });
}

setupOutlook().catch(error => {
  console.error('Setup failed:', error.message);
  process.exit(1);
});
