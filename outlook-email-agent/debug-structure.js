require('dotenv').config();
const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');

async function debugOutlookStructure() {
  console.log('=== Debugging Outlook Email Structure ===\n');
  
  const userDir = path.join(__dirname, 'playwright-profile');
  
  const browser = await chromium.launchPersistentContext(userDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });

  const page = browser.pages()[0] || await browser.newPage();
  
  console.log('Navigating to inbox...');
  await page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Try to find actual email rows with better selectors
  console.log('\n1. Looking for email rows with specific attributes...');
  const emailInfo = await page.evaluate(() => {
    const results = [];
    
    // Look for elements that have email-like structure
    const allElements = Array.from(document.querySelectorAll('[role="presentation"], [role="listitem"], [role="row"]'));
    
    for (const el of allElements) {
      const text = el.textContent?.trim() || '';
      
      // Look for elements that contain email addresses and other email-like content
      if (text.includes('@') && text.length > 20 && text.length < 500) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        
        // Find email address
        const emailAddress = lines.find(l => l.includes('@')) || '';
        
        // Find subject (usually a line without email or time)
        const subject = lines.find(l => 
          l.length > 5 && 
          l.length < 200 && 
          !l.includes('@') && 
          !/^\d{1,2}:\d{2}\s*(am|pm)/i.test(l)
        ) || '';
        
        if (emailAddress && subject) {
          results.push({
            html: el.outerHTML.substring(0, 500),
            text: text.substring(0, 300),
            classes: el.className,
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            dataAutomationId: el.getAttribute('data-automation-id'),
            emailAddress,
            subject,
            lineCount: lines.length
          });
        }
      }
    }
    
    return results.slice(0, 10);
  });
  
  console.log(`Found ${emailInfo.length} potential email rows:\n`);
  emailInfo.forEach((item, i) => {
    console.log(`${i + 1}. Subject: "${item.subject}"`);
    console.log(`   From: ${item.emailAddress}`);
    console.log(`   Role: ${item.role}`);
    console.log(`   Class: ${item.classes?.substring(0, 50)}`);
    console.log(`   Data-automation-id: ${item.dataAutomationId}`);
    console.log(`   Aria-label: ${item.ariaLabel}`);
    console.log(`   Text preview: ${item.text.substring(0, 100)}...`);
    console.log('');
  });
  
  // Try to click on one and get email body
  if (emailInfo.length > 0) {
    console.log('\n2. Attempting to click on first email and extract body...');
    
    try {
      const firstEmail = await page.locator('div, li, [role="listitem"]').filter({ 
        hasText: emailInfo[0].emailAddress 
      }).first();
      
      if (await firstEmail.count() > 0) {
        await firstEmail.click({ timeout: 5000 });
        await page.waitForTimeout(3000);
        
        // Try to extract email body with various selectors
        const emailBody = await page.evaluate(() => {
          const selectors = [
            'div[role="region"][aria-label*="Messagebody"], div[role="region"][aria-label*="Message body"]',
            '[data-automation-id="readingPaneContent"]',
            '[data-testid="readingPane"]',
            'div[role="main"] div[role="document"]',
            '[class*="RichTextEditor"]',
            '[class*="composeContentEditor"]',
            '[contenteditable="true"]'
          ];
          
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              const text = el.textContent?.trim() || '';
              // Look for substantial text content that's not UI
              if (text.length > 100 && text.length < 10000) {
                const isUI = /outlook|file|home|view|help|new|delete|reply|forward|ignore|archive/i.test(text.substring(0, 200));
                if (!isUI) {
                  return {
                    selector,
                    text: text.substring(0, 500),
                    length: text.length,
                    tagName: el.tagName,
                    className: el.className?.substring(0, 100)
                  };
                }
              }
            }
          }
          
          // Fallback: get text from the main area that has sentences
          const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
          if (mainContent) {
            const allText = mainContent.innerText;
            const lines = allText.split('\n').filter(l => l.trim().length > 50);
            if (lines.length > 0) {
              return {
                selector: 'main fallback',
                text: lines[0]?.substring(0, 500) || '',
                length: allText.length,
                tagName: mainContent.tagName,
                linesFound: lines.length
              };
            }
          }
          
          return { text: 'No body content found' };
        });
        
        console.log('\nEmail body extraction result:');
        console.log(`Selector: ${emailBody.selector}`);
        console.log(`Tag: ${emailBody.tagName}`);
        console.log(`Class: ${emailBody.className}`);
        console.log(`Text length: ${emailBody.length} chars`);
        console.log(`\nBody preview:\n${emailBody.text}`);
      }
    } catch (error) {
      console.log(`Error clicking email: ${error.message}`);
    }
  }
  
  console.log('\n3. Browser window is open for inspection. Press Enter to close...');
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  await browser.close();
  console.log('\nDone');
}

debugOutlookStructure().catch(console.error);
