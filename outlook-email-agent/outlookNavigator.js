const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');

class OutlookNavigator {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    const timestamp = Date.now();
    this.userDir = path.join(__dirname, `playwright-profile-${timestamp}`);
  }

  async init() {
    console.log('Starting browser...');

    this.browser = await chromium.launchPersistentContext(this.userDir, {
      headless: config.outlook.headless,
      args: ['--disable-blink-features=AutomationControlled'],
      viewport: { width: 1920, height: 1080 },
      ignoreDefaultArgs: ['--enable-automation'],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    if (this.browser.pages().length > 0) {
      this.page = this.browser.pages()[0];
    } else {
      this.page = await this.browser.newPage();
    }

    await this.page.setDefaultTimeout(30000);

    console.log('Browser started');
  }

  async login() {
    console.log('Navigating to Outlook...');

    await this.page.goto(`${config.outlook.url}`, { waitUntil: 'networkidle', timeout: 30000 });
    await this.page.waitForTimeout(2000);

    const currentUrl = this.page.url();
    console.log(`Current URL: ${currentUrl}`);

    const onLoginPage = currentUrl.includes('login.microsoftonline.com');
    const onOutlookPage = currentUrl.includes('outlook.cloud.microsoft') || currentUrl.includes('outlook.office.com');

    if (onLoginPage) {
      console.log('Login required. Please log in manually - browser will open in visible mode...');
      console.log('⏳ Waiting for user to complete login (60 second timeout)...');

      try {
        await this.page.waitForFunction(() => {
          return !window.location.href.includes('login.microsoftonline.com');
        }, { timeout: 60000 });
        console.log('✓ Login completed!');
      } catch (e) {
        throw new Error('Login timeout - please complete login within 60 seconds');
      }
    } else if (onOutlookPage) {
      console.log('✓ Already logged in - using saved session');
    }

    await this.page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'networkidle', timeout: 30000 });
    await this.page.waitForTimeout(2000);

    const finalUrl = this.page.url();
    console.log(`Final URL: ${finalUrl}`);

    if (finalUrl.includes('outlook.cloud.microsoft/mail')) {
      console.log('✓ Inbox loaded successfully');
    } else if (finalUrl.includes('login')) {
      throw new Error('Redirected to login - authentication failed');
    } else {
      console.log('⚠ Unexpected page - continuing anyway');
    }
  }

  async getUnreadEmails() {
    console.log('Fetching emails...');

    const currentUrl = this.page.url();
    console.log(`Current URL: ${currentUrl}`);

    if (!currentUrl.includes('/mail/')) {
      console.log('Not on mail page, navigating to inbox...');
      await this.page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page.waitForTimeout(3000);
    } else {
      console.log('Already on mail page');
      await this.page.waitForTimeout(1000);
    }

    const finalUrl = this.page.url();
    if (finalUrl.includes('login') || finalUrl.includes('microsoftonline.com')) {
      throw new Error('Redirected to login page - please check authentication');
    }

    const unreadEmails = [];
    
    console.log('Trying multiple selector strategies...');
    
    // Try different selectors to find emails
    const strategies = [
      'div',  // Generic - will find divs, then filter
      '[role="listitem"]',
      '[role="row"]',
      'li[class*="mail"]'
    ];
    
    const rawEmails = [];
    
    // Direct approach: find all elements containing email addresses
    try {
      console.log('  Direct email extraction approach...');
      const directEmails = await this.extractEmailsDirectly();
      console.log(`    Direct extraction found ${directEmails.length} emails`);
      rawEmails.push(...directEmails);
    } catch (e) {
      console.log(`  Direct extraction failed: ${e.message}`);
    }
    
    // Fallback to selector-based approach
    if (rawEmails.length === 0) {
      for (const strategy of strategies) {
        try {
          const count = await this.page.locator(strategy).count();
          console.log(`  Strategy "[${strategy}]": ${count} elements found`);
          
          if (count > 1 && count < 1000) {  // Don't search too many divs
            const emails = await this.page.$$eval(strategy, (elements) => {
              return elements.map((el, index) => {
                const text = el.textContent || '';
                const innerHTML = el.innerHTML || '';
                const hasEmail = text.includes('@');
                const hasDate = /\d+:\d+\s*(am|pm|AM|PM)|Today|Yesterday/i.test(text);
                const fullText = text;

                // Try to extract sender and subject from the text
                let sender = '';
                let subject = '';
                const lines = text.split('\n').map(l => l.trim()).filter(l => l);

                // Find email in lines - that's usually the sender
                for (const line of lines) {
                  if (line.includes('@') && line.match(/[\w.-]+@[\w.-]+\.\w+/)) {
                    sender = line;
                    break;
                  }
                }

                // Subject is usually a line between sender and body/text
                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i];
                  if (line.includes('@')) continue; // skip sender
                  if (/^\d{1,2}:\d{2}\s*(am|pm|AM|PM)$/i.test(line)) continue; // skip time
                  if (line.length > 10 && line.length < 150 && !line.includes(':')) {
                    subject = line;
                    break;
                  }
                }

                return {
                  index,
                  sender: sender || 'unknown',
                  subject: subject || '',
                  fullText: fullText.substring(0, 500),
                  textLength: text.length,
                  hasEmail,
                  hasDate,
                  className: el.className?.substring(0, 100),
                  role: el.getAttribute('role')
                };
              });
            });
            
            // Filter to elements with meaningful content
            const emailLike = emails.filter(e =>
              (e.hasEmail && e.textLength > 20) ||
              (e.hasDate && e.textLength > 30) ||
              (e.textLength > 40 && e.textLength < 500)
            ).filter(e =>
              // Must have either sender with @ or a proper subject
              // Exclude login page elements
              (e.sender.includes('@') || e.subject.length > 10)
            ).filter(e =>
              !e.subject.toLowerCase().includes('enter password') &&
              !e.subject.toLowerCase().includes('sign in') &&
              !e.subject.toLowerCase().includes('login') &&
              !e.subject.toLowerCase().includes('microsoft account') &&
              !e.subject.toLowerCase().includes('no account') &&
              !e.subject.toLowerCase().includes("can't access") &&
              !e.subject.toLowerCase().includes('create one')
            ).filter(e =>
              // Must have a valid-looking subject (not just help text)
              e.subject.length > 5 && e.subject.length < 200
            );
            console.log(`    Filtered to ${emailLike.length} email candidates (req: sender with @ OR valid subject, excluding login pages)`);

            // Show preview of filtered candidates
            emailLike.slice(0, 5).forEach((e, i) => {
              console.log(`      ${i + 1}. Sender: "${e.sender}", Subject: "${e.subject.substring(0, 30)}"`);
            });
            
            if (emailLike.length >= 1) {
              rawEmails.push(...emailLike);
              console.log(`    ✓ Using this strategy with ${emailLike.length} items`);
              break;
            }
          }
        } catch (e) {
          console.log(`  Strategy "[${strategy}]": Error - ${e.message}`);
        }
      }
    }
    
    // If no emails found, try text-based parsing
    if (rawEmails.length === 0) {
      console.log('  No emails found with selectors, trying text-based extraction...');
      const textEmails = await this.extractEmailsFromText();
      rawEmails.push(...textEmails);
    }
    
    console.log(`\nProcessing ${rawEmails.length} raw email items...`);
    
    // Parse raw items into structured email objects
    for (let i = 0; i < Math.min(rawEmails.length, config.monitoring.maxEmailsPerCheck); i++) {
      const item = rawEmails[i];
      
      try {
        // Find and click on the element by its text content
        console.log(`  Trying to open: ${item.sender}`);
        const element = await this.page.locator('div, li, [role="listitem"], [role="button"]').filter({
          hasText: item.sender.substring(0, 50)
        }).first();
        
        if (await element.count() > 0) {
          console.log(`    Clicking element...`);
          await element.click({ timeout: 5000 });
          await this.page.waitForTimeout(3000);
          
          const currentUrl = this.page.url();
          console.log(`    Current URL: ${currentUrl}`);
          
          // Check if we're now on an email detail page or still on inbox
          if (currentUrl.includes('/mail/') && !currentUrl.includes('/inbox')) {
            console.log(`    ✓ Opened email detail page`);
          } else {
            console.log(`    ⚠ Still on inbox, checking reading pane`);
          }
        } else {
          console.log(`    Element not found for: ${item.sender}`);
          continue;
        }
        
        // Extract email details from the opened email or reading pane
        console.log(`    Extracting email details...`);
        const emailDetails = await this.page.evaluate(() => {
          // Look for email content in different locations
          const result = {
            subject: '',
            sender: '',
            body: '',
            date: new Date().toISOString(),
            unread: true
          };
          
          // Try to find subject from visible page
          const possibleSubjects = [
            document.querySelector('[data-testid="subject"], h1, .ms-ScrollablePane h1'),
            document.querySelector('[class*="subject"]'),
            document.querySelector('[aria-label*="subject"]')
          ];
          
          for (const el of possibleSubjects) {
            if (el && el.textContent && el.textContent.trim().length > 2 && el.textContent.trim().length < 200) {
              result.subject = el.textContent.trim();
              console.log(`Found subject: ${result.subject}`);
              break;
            }
          }
          
          // Try to find sender
          const possibleSenders = [
            document.querySelector('[data-testid=""], [data-client-id]'),
            document.querySelector('.ms-Persona, [class*="Persona"]'),
            document.querySelector('[class*="sender"], [class*="From"]')
          ];
          
          for (const el of possibleSenders) {
            if (el && el.textContent) {
              const text = el.textContent.trim();
              if (text.length > 5 && text.length < 100 && text.match(/\w/)) {
                result.sender = text;
                break;
              }
            }
          }
          
          // Try to find body
          const possibleBodies = [
            document.querySelector('[data-testid="body"]'),
            document.querySelector('[role="region"][aria-label*="message"], [role="region"][aria-label*="Message"]'),
            document.querySelector('[role="region"].readingPaneContent'),
            document.querySelector('[class*="readingPaneBody"], [class*="bodyContent"]'),
            document.querySelector('[id*="ItemBody"], div[id*="ItemBody"]'),
            document.querySelector('div[role="document"]'),
            document.querySelector('.ms-ScrollablePane > div'),
            document.querySelector('[class*="content"]'),
            document.querySelector('[class*="body"]')
          ];

          console.log(`DEBUG: Looking for email body...`);
          
          for (const el of possibleBodies) {
            if (el) {
              const text = el.textContent || '';
              console.log(`DEBUG: Body selector candidate: ${el.tagName}.${el.className?.substring(0, 30) || ''}, textLength=${text.trim().length}`);
              if (text.trim().length > 50) {
                result.body = text.trim();
                console.log(`Found body: ${result.body.substring(0, 50)}...`);
                break;
              }
            }
          }

          // If still no body, try broader search
          if (!result.body || result.body.length < 20) {
            console.log(`DEBUG: No body found yet, trying broader search...`);
            const allDivs = Array.from(document.querySelectorAll('div'));
            for (const div of allDivs) {
              const text = div.textContent || '';
              if (text.trim().length > 100 && text.trim().length < 5000) {
                const hasPunctuation = /[.!?]/.test(text);
                const hasNewlines = text.includes('\n');
                if (hasPunctuation || hasNewlines) {
                  result.body = text.trim();
                  console.log(`Found body via fallback: ${result.body.substring(0, 50)}...`);
                  break;
                }
              }
            }
          }
          
          return result;
        });
        
        // If subject still empty, use the one we found in the list
        if (!emailDetails.subject || emailDetails.subject.length < 3) {
          emailDetails.subject = item.subject || 'No Subject';
          console.log(`    Using subject from list: ${emailDetails.subject}`);
        }
        
        // If sender still empty, use the one we found in the list
        if (!emailDetails.sender || emailDetails.sender === 'Unknown' || emailDetails.sender.length < 5) {
          emailDetails.sender = item.sender || 'Unknown';
          console.log(`    Using sender from list: ${emailDetails.sender}`);
        }
        
        console.log(`    Final: Subject="${emailDetails.subject.substring(0, 40)}", Sender="${emailDetails.sender.substring(0, 30)}"`);
        
        if (emailDetails.subject && emailDetails.subject !== 'No Subject') {
          unreadEmails.push({
            sender: emailDetails.sender,
            subject: emailDetails.subject,
            body: emailDetails.body,
            date: emailDetails.date,
            unread: true,
            receivedAt: new Date(emailDetails.date)
          });
          
          console.log(`  ✓ Email ${unreadEmails.length} extracted: "${emailDetails.subject}"`);
        } else {
          console.log(`    ❌ Skipping: No valid subject found`);
        }
        
        // Go back to inbox
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(1000);
        
      } catch (e) {
        console.log(`  Error processing item ${i}: ${e.message}`);
      }
    }
    
    console.log(`\nFound ${unreadEmails.length} emails to process`);
    return unreadEmails;
  }

  async extractEmailsFromText() {
    const textContent = await this.page.evaluate(() => document.body.innerText);
    const lines = textContent.split('\n').map(l => l.trim()).filter(l => l.length > 10);
    
    const emails = [];
    let currentEmail = {};
    
    for (const line of lines.slice(0, 100)) {
      if (line.includes('@')) {
        if (emails.length > 0 && currentEmail.subject) {
          emails.push(currentEmail);
        }
        currentEmail = { sender: line, text: line, index: emails.length, hasEmail: true, hasDate: true };
      } else if (line.length < 100 && !line.includes(':')) {
        currentEmail.subject = line;
      }
    }
    
    return emails;
  }

  async extractEmailsDirectly() {
    // Try Outlook-specific selectors first
    const outlookSpecific = await this.page.evaluate(() => {
      const results = [];

      // Try multiple Outlook-specific selectors for email rows
      const selectors = [
        'div[role="listitem"][role="row"]',
        'div[role="row"].ms-FocusZone',
        'div[role="row"] div[role="gridcell"]',
        'div[role="list"]:not([role="listbox"]) > div[role="listitem"]',
        'ul[role="listbox"] > li[role="option"]',
        '[data-is-focusable="true"][role="row"]',
        '.ms-List-item',
        '[role="treeitem"]'
      ];

      for (const selector of selectors) {
        try {
          const elements = Array.from(document.querySelectorAll(selector));
          console.log(`Trying selector: ${selector}, found ${elements.length} elements`);

          for (const el of elements) {
            const text = el.textContent?.trim() || '';
            if (text.length < 20 || text.length > 1000) continue;

            const lines = text.split('\n').map(l => l.trim()).filter(l => l);

            // Try to find email/sender
            let sender = lines.find(l => l.includes('@') && l.includes('.'));
            if (!sender) {
              sender = lines.find(l => l.length > 5 && l.length < 100 && l.split(' ').length >= 2);
            }

            // Try to find subject (line after sender/time)
            let subject = '';
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.includes('@')) continue;
              if (/^\d{1,2}:\d{2}\s*(am|pm|AM|PM)$/i.test(line)) continue;
              if (line.length > 10 && line.length < 150 && !line.includes(':')) {
                subject = line;
                break;
              }
            }

            if (sender && subject) {
              results.push({
                sender: sender.substring(0, 100),
                subject: subject.substring(0, 100),
                text: text.substring(0, 200),
                tagName: el.tagName,
                className: el.className?.substring(0, 50),
                index: results.length
              });
            }
          }

          if (results.length > 0) {
            console.log(`Found ${results.length} emails with selector: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`Selector ${selector} failed: ${e.message}`);
        }
      }

      return results;
    });

    if (outlookSpecific.length > 0) {
      console.log(`    Found ${outlookSpecific.length} clickable email rows (Outlook-specific)`);
      outlookSpecific.forEach((e, i) => {
        console.log(`      ${i + 1}. ${e.sender}: "${e.subject.substring(0, 40)}"`);
      });
      return outlookSpecific;
    }

    // Fallback: Find clickable elements that contain sender names and subjects
    const emails = await this.page.evaluate(() => {
      const results = [];

      // Look for elements that might be clickable email rows
      const clickables = Array.from(document.querySelectorAll('div, li, a, [role="listitem"], [role="button"]'));

      for (const el of clickables) {
        const text = el.textContent?.trim() || '';
        const isClickable = el.tagName === 'BUTTON' ||
                           el.tagName === 'A' ||
                           el.getAttribute('role') === 'button' ||
                           el.getAttribute('role') === 'listitem' ||
                           el.onclick !== null;

        // Look for elements with sender names and that are substantial
        if (isClickable && text.length > 30 && text.length < 500) {
          // Check if it looks like an email entry
          const hasSender = /\w+\s+\w+@/.test(text) || /\w+\s+\w{2,}/.test(text);
          const hasSubject = text.split('\n').some(line => line.length > 10 && line.length < 100);
          const hasTime = /\d{1,2}:\d{2}/.test(text);

          if ((hasSender || hasTime) && hasSubject) {
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);

            // Try to identify sender (has email or pattern)
            let sender = lines.find(l => l.includes('@') && l.includes('.')) ||
                        lines.find(l => /^[\w\s]{5,50}$/.test(l) && l.split(' ').length >= 2) ||
                        lines[0] || '';

            // Try to identify subject (reasonable length, no email)
            let subject = lines.find(l => l.length > 10 && l.length < 150 && !l.includes('@') && !l.includes(':')) ||
                          lines[lines.length - 1] || '';

            if (sender && subject) {
              results.push({
                sender: sender.substring(0, 100),
                subject: subject.substring(0, 100),
                text: text.substring(0, 200),
                tagName: el.tagName,
                className: el.className?.substring(0, 50),
                isClickable,
                index: results.length
              });
            }
          }
        }
      }

      // Remove duplicates
      const unique = [];
      const seen = new Set();

      for (const el of results) {
        const key = el.sender + el.subject;
        if (!seen.has(key) && unique.length < 10) {
          seen.add(key);
          unique.push(el);
        }
      }

      return unique;
    });

    console.log(`    Found ${emails.length} clickable email rows (fallback)`);
    emails.forEach((e, i) => {
      console.log(`      ${i + 1}. ${e.sender}: "${e.subject.substring(0, 40)}"`);
    });

    return emails;
  }

  async saveDraft(email, replyDraft) {
    console.log(`Saving draft for: ${email.subject}`);
    
    await this.page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'networkidle' });

    const emailRow = await this.page.locator('[role="row"]').filter({
      hasText: email.subject
    }).first();
    
    await emailRow.click();
    await this.page.waitForTimeout(1500);

    try {
      const replyButton = await this.page.locator('[data-testid="replyButton"], [data-icon-name="Reply"], button[aria-label*="Reply"]').first();
      
      if (await replyButton.isVisible()) {
        await replyButton.click();
        await this.page.waitForTimeout(1500);

        const replyEditor = await this.page.locator('[role="textbox"], [contenteditable="true"]').first();
        
        if (await replyEditor.isVisible()) {
          await replyEditor.fill(replyDraft);
          
          const saveButton = await this.page.locator('[data-testid="saveDraftButton"], button[aria-label*="Save"], button:has-text("Save")').first();
          
          if (await saveButton.isVisible()) {
            await saveButton.click();
            console.log('Draft saved successfully');
            
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(1000);
            return true;
          }
        }
      }

      console.log('Could not save draft');
      return false;
    } catch (e) {
      console.log(`Error saving draft: ${e.message}`);
      
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(1000);
      return false;
    }
  }

  async close() {
    console.log('Closing browser...');
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = OutlookNavigator;
