require('dotenv').config();
const { chromium } = require('playwright');
const config = require('./config');
const fs = require('fs');
const path = require('path');

async function quickInspect() {
  console.log('=== Quick Outlook Check ===\n');
  
  console.log('Opening browser (you may need to login)...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('Page loaded. Waiting 10 seconds for full load...');
    await page.waitForTimeout(10000);
    
    console.log('\nCurrent URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Get page text
    const text = await page.evaluate(() => document.body.innerText);
    
    console.log('\n--- Found these text patterns that look like emails ---');
    const lines = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5 && l.length < 150)
      .filter(l => l.includes('@') || /(reply|forward|subject|from|to)/i.test(l));
    
    lines.slice(0, 20).forEach((line, i) => {
      console.log(`${i + 1}: ${line}`);
    });
    
    console.log('\n--- Browser window is visible above ---');
    console.log('Can you see your emails in that window?');
    console.log('Press Enter to close browser...');
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

quickInspect().catch(console.error);
