const { chromium } = require('playwright');
const config = require('./config');
const path = require('path');

class OutlookNavigator {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.userDir = path.join(__dirname, 'playwright-profile');
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
    console.log('[NAVIGATOR] Initializing Reading Pane extraction...');
    const unreadEmails = [];
    const maxEmails = config.monitoring?.maxEmailsPerCheck || 10;

    try {
      // Navigate to Inbox and wait for the list to be interactive
      await this.page.goto(`${config.outlook.url}/mail/inbox`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for the mail list container to appear
      await this.page.waitForSelector('[role="main"]', { timeout: 15000 });

      // Reset focus to the top of the list
      await this.page.keyboard.press('Home');
      await this.page.waitForTimeout(1000); // Allow selection UI to catch up

      for (let i = 0; i < maxEmails; i++) {
        console.log(`[NAVIGATOR] Processing item ${i + 1}...`);

        // Extract metadata from the currently focused list item
        const emailMetadata = await this.page.evaluate(() => {
          const activeElement = document.activeElement;
          const isEmailItem = activeElement?.getAttribute('role') === 'listitem' ||
                             activeElement?.getAttribute('role') === 'row';

          if (!isEmailItem) return null;

          // Check if unread: Outlook usually adds an 'unread' class or ARIA label
          const isUnread = activeElement.getAttribute('aria-label')?.toLowerCase().includes('unread') ||
                          !!activeElement.querySelector('[class*="unread"]');

          if (!isUnread) return { skip: true };

          // Extract sender and subject from the focused row
          const text = activeElement.innerText || "";
          const lines = text.split('\n').filter(l => l.trim().length > 0);

          return {
            skip: false,
            sender: lines[0] || "Unknown Sender",
            subject: lines[1] || "No Subject",
            isUnread: true
          };
        });

        // If we've reached the end or a non-email item, break
        if (!emailMetadata) break;

        // If unread, extract the body from the Reading Pane
        if (!emailMetadata.skip) {
          // Wait briefly for the reading pane to update after focus
          await this.page.waitForTimeout(800);

          const bodyContent = await this.page.evaluate(() => {
            // Target the Reading Pane specifically via ARIA regions
            const readingPane = document.querySelector('[role="region"][aria-label*="Message"], [id*="ReadingPane"]');
            if (!readingPane) return "Could not locate reading pane content.";

            // Clone to avoid modifying live DOM, remove potential script tags
            const content = readingPane.innerText || "";
            return content.substring(0, 5000).trim(); // Limit length for LLM processing
          });

          unreadEmails.push({
            sender: emailMetadata.sender,
            subject: emailMetadata.subject,
            body: bodyContent,
            date: new Date().toISOString(),
            unread: true
          });

          console.log(`[NAVIGATOR] ✓ Successfully captured: ${emailMetadata.subject}`);
        } else {
          console.log(`[NAVIGATOR] Skipping read email.`);
        }

        // Navigate to the next email
        await this.page.keyboard.press('ArrowDown');
        await this.page.waitForTimeout(200); // Small debounce for UI stability
      }

      console.log(`[NAVIGATOR] Finished check. Found ${unreadEmails.length} unread emails.`);
      return unreadEmails;

    } catch (error) {
      console.error(`[NAVIGATOR ERROR] Failed to extract emails: ${error.message}`);
      // Capture screenshot for debugging if it fails
      await this.page.screenshot({ path: `error-getUnread-${Date.now()}.png` });
      return unreadEmails; // Return what we found before the error
    }
  }

  async saveDraft(email, replyDraft) {
    console.log(`Saving draft for: ${email.subject}`);

    try {
      await this.page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'networkidle' });

      const emailRow = await this.page.locator('[role="row"]').filter({
        hasText: email.subject
      }).first();

      await emailRow.click();
      await this.page.waitForTimeout(1500);

      const replyButton = await this.page.locator('[data-testid="replyButton"], [data-icon-name="Reply"], button[aria-label*="Reply"]').first();

      if ((await replyButton.count()) > 0 && await replyButton.isVisible()) {
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
