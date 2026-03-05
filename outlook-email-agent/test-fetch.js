require('dotenv').config();
const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');

async function testEmailFetch() {
  console.log('=== Testing Email Fetch ===\n');
  
  const userDir = path.join(__dirname, 'playwright-profile');
  
  const browser = await chromium.launchPersistentContext(userDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });

  const page = browser.pages()[0] || await browser.newPage();
  
  console.log('1. Navigating to inbox...');
  await page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  console.log('2. Waiting for page to load...');
  await page.waitForTimeout(5000);
  
  console.log(`3. Current URL: ${page.url()}`);
  console.log(`4. Page title: ${await page.title()}`);
  
  // Try multiple selector strategies
  console.log('\n5. Searching for emails...');
  
  // Strategy 1: Try Outlook's modern selectors
  try {
    const emails1 = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="presentation"]'));
      return items.slice(0, 10).map(item => ({
        html: item.innerHTML.substring(0, 300),
        classes: item.className,
        role: item.getAttribute('role')
      }));
    });
    console.log(`   Found ${emails1.length} [role="presentation"] items`);
    emails1.forEach((item, i) => {
      console.log(`   Item ${i}: ${item.html.substring(0, 100)}...`);
    });
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  // Strategy 2: Look for any readable text
  console.log('\n6. Scanning visible text for email patterns...');
  const pageText = await page.evaluate(() => {
    const allText = document.body.innerText;
    const lines = allText.split('\n').filter(line => line.trim().length > 5 && line.length < 200);
    return lines.slice(0, 50);
  });
  
  pageText.forEach((line, i) => {
    console.log(`   ${i + 1}: ${line}`);
  });
  
  // Strategy 3: Check for actual reading pane vs list view
  console.log('\n7. Checking page structure...');
  const structure = await page.evaluate(() => {
    return {
      hasEmailList: !!document.querySelector('[role="list"], [role="application"]'),
      hasReadingPane: !!document.querySelector('[role="region"]'),
      allRoles: Array.from(new Set(Array.from(document.querySelectorAll('[role]')).map(el => el.getAttribute('role')))).join(', '),
      summaryText: document.body.innerText.substring(0, 1000)
    };
  });
  
  console.log(`   Structure:`, structure);
  
  console.log('\n8. Checking if any email-related elements exist...');
  const allA = await page.$$('a');
  console.log(`   Found ${allA.length} link elements`);
  
  const allDivs = await page.$$('div');
  console.log(`   Found ${allDivs.length} div elements`);
  
  const allSpans = await page.$$('span');
  console.log(`   Found ${allSpans.length} span elements`);
  
  console.log('\n9. Browser window is open for MANUAL inspection.');
  console.log('   Can you see your emails in the window?');
  console.log('   Is the folder showing "Inbox"?');
  console.log('   Are there unread emails visible?');
  console.log('\n   Press Enter to close...');
  
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  await browser.close();
  console.log('\nDone');
}

testEmailFetch().catch(console.error);
