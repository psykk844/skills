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
    console.log('[NAVIGATOR] Initializing email extraction...');
    const unreadEmails = [];
    const maxEmails = config.monitoring?.maxEmailsPerCheck || 10;

    try {
      await this.page.goto(`${config.outlook.url}/mail/inbox`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await this.page.waitForSelector('[role="main"]', { timeout: 15000 });
      await this.page.waitForTimeout(2000);

      const emails = await this.page.evaluate((maxEmails) => {
        const unreadList = [];

        const emailRows = Array.from(
          document.querySelectorAll(
            '[role="listitem"][data-is-unread="true"], ' +
            'div[role="row"][aria-label*="unread"], ' +
            '[data-automation-id*="mail-list-item"]:not([class*="ms-List-cell--isUnread"])'
          )
        );

        if (emailRows.length === 0) {
          const allRows = Array.from(
            document.querySelectorAll('[role="listitem"], [role="row"]')
          );

          for (const row of allRows) {
            const className = row.className || '';
            const hasUnreadClass =
              className.includes('unread') ||
              className.includes('ms-List-cell--focused') ||
              !!row.querySelector('[class*="blue"], [class*="indicator"]');

            const text = row.innerText || '';
            if (text.trim().length > 0 && hasUnreadClass) {
              emailRows.push(row);
            }
          }
        }

        for (const row of emailRows.slice(0, maxEmails)) {
          try {
            const text = row.innerText || '';
            const lines = text
              .split('\n')
              .map(l => l.trim())
              .filter(l => l.length > 0);

            const sender = lines[0] || 'Unknown Sender';
            const subject = lines[1] || '(No subject)';

            unreadList.push({
              sender,
              subject,
              rowElement: row.className
            });
          } catch (e) {
            console.error('Error parsing row:', e);
          }
        }

        return unreadList;
      }, maxEmails);

      console.log(`[NAVIGATOR] Found ${emails.length} unread emails via DOM query`);

      for (const email of emails) {
        try {
          await this.page.evaluate((senderName) => {
            const rows = Array.from(
              document.querySelectorAll('[role="listitem"], [role="row"]')
            );
            const targetRow = rows.find(row =>
              row.innerText?.includes(senderName)
            );
            if (targetRow) targetRow.click();
          }, email.sender);

          await this.page.waitForTimeout(1500);

          const bodyContent = await this.page.evaluate(() => {
            const selectors = [
              '[id*="ReadingPane"]',
              '[role="region"][aria-label*="Message"]',
              '[data-automation-id*="ReadingPane"]',
              '[class*="MessageRoot"]'
            ];

            for (const selector of selectors) {
              const pane = document.querySelector(selector);
              if (pane && pane.innerText?.trim().length > 0) {
                return pane.innerText.substring(0, 5000).trim();
              }
            }

            return '(Body content not extracted)';
          });

          unreadEmails.push({
            sender: email.sender,
            subject: email.subject,
            body: bodyContent,
            date: new Date().toISOString(),
            unread: true
          });

          console.log(
            `[NAVIGATOR] ✓ Extracted: "${email.subject.substring(0, 50)}"`
          );
        } catch (e) {
          console.error(
            `[NAVIGATOR] Failed to extract body for ${email.subject}:`,
            e.message
          );
        }
      }

      console.log(
        `[NAVIGATOR] Finished extraction. Found ${unreadEmails.length} unread emails.`
      );
      return unreadEmails;
    } catch (error) {
      console.error(`[NAVIGATOR ERROR] ${error.message}`);
      await this.page
        .screenshot({ path: `error-getUnread-${Date.now()}.png` })
        .catch(() => {});
      return unreadEmails;
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
