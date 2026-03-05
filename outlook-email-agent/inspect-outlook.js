require('dotenv').config();
const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');
const fs = require('fs');

async function inspectOutlook() {
  console.log('=== Outlook DOM Inspector ===\n');
  
  const userDir = path.join(__dirname, 'playwright-profile');
  
  const browser = await chromium.launchPersistentContext(userDir, {
    headless: false,  // Visible mode
    viewport: { width: 1920, height: 1080 }
  });

  const page = browser.pages()[0] || await browser.newPage();
  
  console.log('Opening Outlook (will be visible on your screen)...');
  await page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  await page.waitForTimeout(7000);  // Wait 7 seconds for full load
  
  // Take a screenshot
  const screenshotPath = path.join(__dirname, 'outlook-screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to: ${screenshotPath}`);
  
  // Get and save HTML
  const html = await page.content();
  const htmlPath = path.join(__dirname, 'outlook-html.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`HTML saved to: ${htmlPath}`);
  
  // Analyze DOM structure
  console.log('\n--- DOM Analysis ---');
  
  const analysis = await page.evaluate(() => {
    const result = {
      url: window.location.href,
      title: document.title,
      totalElements: document.querySelectorAll('*').length,
      roles: {},
      dataAttributes: new Set(),
      possibleEmailItems: [],
      pageTextSample: document.body.innerText.substring(0, 2000)
    };
    
    // Get all unique roles
    document.querySelectorAll('[role]').forEach(el => {
      const role = el.getAttribute('role');
      result.roles[role] = (result.roles[role] || 0) + 1;
    });
    
    // Get all data- attributes
    document.querySelectorAll('[data-*]').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          result.dataAttributes.add(attr.name);
        }
      });
    });
    
    // Look for elements that might be email items
    const selectors = [
      '[role="listitem"]',
      '[role="row"]', 
      '[role="presentation"]',
      '[data-icon-name]',
      '[class*="mail"]',
      '[class*="email"]',
      '[class*="item"]'
    ];
    
    selectors.forEach(sel => {
      const items = document.querySelectorAll(sel);
      if (items.length > 0) {
        result.possibleEmailItems.push({
          selector: sel,
          count: items.length,
          sampleHTML: items[0]?.outerHTML?.substring(0, 300) || ''
        });
      }
    });
    
    return result;
  });
  
  console.log(`URL: ${analysis.url}`);
  console.log(`Title: ${analysis.title}`);
  console.log(`Total elements: ${analysis.totalElements}`);
  console.log(`\nRoles found:`);
  Object.entries(analysis.roles).forEach(([role, count]) => {
    console.log(`  ${role}: ${count}`);
  });
  console.log(`\nPossible email items:`);
  analysis.possibleEmailItems.forEach(item => {
    console.log(`  [${item.selector}]: ${item.count} items`);
    console.log(`    Sample: ${item.sampleHTML.substring(0, 150)}...`);
  });
  console.log(`\nPage text sample:`);
  console.log(analysis.pageTextSample);
  
  // Wait for user to close
  console.log('\n--- Browser is visible ---');
  console.log('Check if you can see your emails in the browser window.');
  console.log('Press Enter to close the browser...');
  
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  await browser.close();
  console.log('\nDone! Check the screenshot and HTML file to see the DOM structure.');
}

inspectOutlook().catch(console.error);
