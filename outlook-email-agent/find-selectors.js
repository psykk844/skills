require('dotenv').config();
const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');
const fs = require('fs');

async function findEmailSelectors() {
  console.log('=== Finding Outlook Email Selectors ===\n');
  
  const userDir = path.join(__dirname, 'playwright-profile');
  
  const browser = await chromium.launchPersistentContext(userDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });

  const page = browser.pages()[0] || await browser.newPage();
  
  console.log('Loading Outlook...');
  await page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(10000);
  
  console.log('Analyzing DOM structure...\n');
  
  const analysis = await page.evaluate(() => {
    const results = [];
    
    // Find all elements that contain text (likely emails)
    const allElements = document.querySelectorAll('*');
    
    // Look for patterns
    const candidates = new Map();
    
    allElements.forEach(el => {
      const role = el.getAttribute('role');
      const className = el.className || '';
      const id = el.id || '';
      const dataAttributes = Array.from(el.attributes)
        .filter(a => a.name.startsWith('data-'))
        .map(a => a.name)
        .join(',');
      
      // Check if it looks like an email row
      const hasEmailText = el.textContent.match(/@/g)?.length > 0;
      const hasUrl = el.querySelector('a[href]');
      const hasMultipleLines = el.querySelectorAll('span, div').length > 3;
      
      const isUnread = el.className.includes('unread') || 
                      el.className.includes('Unread') ||
                      el.getAttribute('data-unread') !== null;
      
      if (role || className.length < 50 || dataAttributes) {
        const key = `role="${role}" class="${className}" ${dataAttributes}`;
        if (candidates.has(key)) {
          candidates.get(key).count++;
        } else {
          candidates.set(key, {
            selector: key,
            count: 1,
            hasEmailText,
            isUnread,
            sampleHTML: el.outerHTML.substring(0, 200)
          });
        }
      }
    });
    
    // Convert to array and sort by count
    return Array.from(candidates.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map(item => ({
        selector: item.selector.substring(0, 100),
        count: item.count,
        hasEmailText: item.hasEmailText,
        isUnread: item.isUnread,
        sampleHTML: item.sampleHTML.substring(0, 150)
      }));
  });
  
  console.log('Top email-like elements found:');
  console.log('----------------------------------------');
  analysis.forEach((item, i) => {
    console.log(`\n${i + 1}. (${item.count} items)`);
    console.log(`   ${item.selector}`);
    if (item.hasEmailText) console.log(`   ✓ Contains email text`);
    if (item.isUnread) console.log(`   ✓ Can detect unread`);
    console.log(`   Sample: ${item.sampleHTML}...`);
  });
  
  // Now try to extract actual emails using different approaches
  console.log('\n\n=== Trying to extract actual emails ===\n');
  
  const emailExtractions = {};
  
  // Approach 1: Look for elements with @ sign (likely email addresses)
  const approach1 = await page.evaluate(() => {
    const emailRows = [];
    document.querySelectorAll('*').forEach(el => {
      const text = el.textContent.trim();
      if (text.includes('@') && text.length < 200 && text.length > 10) {
        const parent = el.closest('[role], div[class], li');
        if (parent && !emailRows.includes(parent)) {
          emailRows.push({
            html: parent.outerHTML.substring(0, 500),
            role: parent.getAttribute('role'),
            className: parent.className
          });
        }
      }
    });
    return emailRows.slice(0, 5);
  });
  emailExtractions.approach1 = approach1;
  
  console.log('Approach 1 - Elements with @ sign:');
  approach1.forEach((item, i) => {
    console.log(`${i + 1}. role="${item.role}" class="${item.className.substring(0, 50)}"`);
    console.log(`   ${item.html}...`);
  });
  
  // Save full HTML for manual inspection
  const html = await page.content();
  const htmlPath = path.join(__dirname, 'outlook-dom-analysis.html');
  fs.writeFileSync(htmlPath, html);
  console.log(`\nFull HTML saved to: ${htmlPath}`);
  
  console.log('\n\n=== Browser is visible above ===');
  console.log('Check the browser and告诉我: what class or role do the email rows have?');
  console.log('Right-click an email in the list → Inspect → Look at its attributes');
  console.log('\nPress Enter to close browser...');
  
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  await browser.close();
  console.log('\nDone!');
}

findEmailSelectors().catch(console.error);
