require('dotenv').config();
const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');

async function debugInbox() {
  console.log('=== Outlook Inbox Debug ===\n');
  
  const userDir = path.join(__dirname, 'playwright-profile');
  
  const browser = await chromium.launchPersistentContext(userDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });

  const page = browser.pages()[0] || await browser.newPage();
  
  console.log('Navigating to inbox...');
  await page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'networkidle' });
  
  await page.waitForTimeout(3000);
  
  // Try to find email row elements with different selectors
  console.log('\n1. Looking for [role="row"] elements...');
  const roleRows = await page.$$('[role="row"]');
  console.log(`   Found: ${roleRows.length} elements`);
  
  if (roleRows.length > 0) {
    const firstRow = roleRows[0];
    const html = await firstRow.innerHTML();
    console.log(`   First row HTML: ${html.substring(0, 500)}...`);
  }
  
  console.log('\n2. Looking for email list items...');
  const emailItems = await page.$$('[role="listitem"], [data-icon-name="Mail"]');
  console.log(`   Found: ${emailItems.length} elements`);
  
  console.log('\n3. Looking for generic div elements...');
  const allDivs = await page.$$('div');
  console.log(`   Found: ${allDivs.length} div elements`);
  
  console.log('\n4. Looking for unread indicators...');
  const unreadElements = await page.$$('[data-unread], [class*="unread"], .unread');
  console.log(`   Found: ${unreadElements.length} elements`);
  
  console.log('\n5. Looking for sender names...');
  const senderElements = await page.$$('[title*="@"]');
  console.log(`   Found: ${senderElements.length} elements`);
  for (let i = 0; i < Math.min(3, senderElements.length); i++) {
    const text = await senderElements[i].textContent();
    console.log(`      ${text}`);
  }
  
  console.log('\n6. Looking for subject lines...');
  const subjectSelectors = [
    'span[class*="subject"]',
    '[data-priority="subject"]',
    'div[role="gridcell"] span',
    '[title][class*="subject"]'
  ];
  
  for (const selector of subjectSelectors) {
    const elements = await page.$$(selector);
    if (elements.length > 0) {
      console.log(`   Selector [${selector}]: ${elements.length} found`);
      for (let i = 0; i < Math.min(3, elements.length); i++) {
        const text = await elements[i].textContent();
        console.log(`      ${text?.substring(0, 50)}`);
      }
    }
  }
  
  console.log('\n7. Getting page title and URL...');
  console.log(`   Page title: ${await page.title()}`);
  console.log(`   URL: ${page.url()}`);
  
  console.log('\n8. Looking for any text content that looks like email subjects...');
  const pageText = await page.evaluate(() => {
    const allText = document.body.innerText;
    return allText.substring(0, 2000);
  });
  console.log(`   Page text preview: ${pageText}`);
  
  console.log('\n=== Debug Complete ===');
  console.log('Browser window is open for manual inspection.');
  console.log('Press Enter to close browser...');
  
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  await browser.close();
}

debugInbox().catch(console.error);
