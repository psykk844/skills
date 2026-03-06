require('dotenv').config();
const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');

async function setup() {
  const userDir = path.join(__dirname, 'playwright-profile');

  console.log('Opening browser - please log into Outlook...');
  const browser = await chromium.launchPersistentContext(userDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = browser.pages()[0] || await browser.newPage();
  await page.goto(config.outlook.url, { waitUntil: 'networkidle', timeout: 30000 });

  console.log('Waiting for you to log in... (auto-detects when inbox is ready)');

  // Auto-detect successful login - no typing needed
  try {
    await page.waitForFunction(() => {
      const url = window.location.href;
      return (url.includes('outlook.cloud.microsoft/mail') || url.includes('outlook.office.com/mail')) &&
             !url.includes('login.microsoftonline.com');
    }, { timeout: 120000 });

    console.log('Logged in! Waiting for inbox to fully load...');
    await page.waitForTimeout(4000);
    console.log('Session saved. Browser closing...');
  } catch (e) {
    console.log('Timed out waiting for login. Please try again.');
  }

  await browser.close();
  console.log('Done! Run: npm start');
  process.exit(0);
}

setup().catch(e => { console.error('Setup failed:', e.message); process.exit(1); });
