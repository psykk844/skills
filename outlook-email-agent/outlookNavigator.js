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

    await this.page.goto(`${config.outlook.url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
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

    await this.page.goto(`${config.outlook.url}/mail/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(3000);

    const finalUrl = this.page.url();
    console.log(`Final URL: ${finalUrl}`);

    if (finalUrl.includes('login.microsoftonline.com') || finalUrl.includes('login.live.com')) {
      throw new Error('Redirected to login - session expired. Run: npm run setup');
    } else if (finalUrl.includes('outlook.cloud.microsoft/mail') || finalUrl.includes('outlook.office.com/mail')) {
      console.log('✓ Inbox loaded successfully');
      // Try clicking Inbox in sidebar to ensure email list is visible
      try {
        const inboxLink = this.page.locator('a, button, [role="treeitem"]').filter({ hasText: /^Inbox$/i }).first();
        if (await inboxLink.count() > 0) {
          await inboxLink.click();
          await this.page.waitForTimeout(1500);
          console.log('✓ Clicked Inbox sidebar item');
        }
      } catch (_) { /* sidebar click optional */ }
    } else {
      console.log('⚠ Unexpected page - continuing anyway');
    }
  }

  async _waitForEmailList() {
    console.log('[NAVIGATOR] Waiting for email list to render...');

    const emailListSelectors = [
      '[role="listbox"]',
      '[role="listbox"] [role="option"]',
      '[role="grid"]',
      '[data-automation-id="mail-list"]',
      '[role="list"]',
    ];

    for (const selector of emailListSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        console.log(`[NAVIGATOR] Email list found with selector: ${selector}`);
        return selector;
      } catch (_) {
        // try next
      }
    }

    // Fallback: wait for [role="main"] or any substantial content
    try {
      await this.page.waitForSelector('[role="main"]', { timeout: 10000 });
      console.log('[NAVIGATOR] Found [role="main"]');
    } catch (_) {
      console.log('[NAVIGATOR] [role="main"] not found, using MutationObserver fallback...');
      await this.page.evaluate(() => {
        return new Promise((resolve) => {
          const selectors = [
            '[role="grid"]',
            '[data-automation-id="mail-list"]',
            '[role="list"]',
            '[role="main"]',
          ];
          const check = () => selectors.some(s => document.querySelector(s));
          if (check()) return resolve();
          const observer = new MutationObserver(() => {
            if (check()) { observer.disconnect(); resolve(); }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          setTimeout(() => { observer.disconnect(); resolve(); }, 25000);
        });
      });
    }

    // Extra settle time after list appears
    await this.page.waitForTimeout(2000);
    return null;
  }

  async checkSession() {
    try {
      await this.page.goto(`${config.outlook.url}/mail/inbox`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      const url = this.page.url();
      const isLoginPage = url.includes('login.microsoftonline.com') || url.includes('login.live.com');

      if (isLoginPage) {
        console.log('\n==================================================');
        console.log('SESSION EXPIRED - ACTION REQUIRED');
        console.log('Your Outlook session has expired (e.g. PC woke from sleep).');
        console.log('The browser window will open for you to log in.');
        console.log('You have 90 seconds to complete login.');
        console.log('==================================================\n');

        // Force visible mode for re-login
        if (config.outlook.headless) {
          console.log('[SESSION] Note: running headless - you may need to restart with HEADLESS=false to log in');
          return false;
        }

        try {
          await this.page.waitForFunction(
            () => !window.location.href.includes('login.microsoftonline.com') && !window.location.href.includes('login.live.com'),
            { timeout: 90000 }
          );
          console.log('[SESSION] Re-login successful - resuming normal operation');
          return true;
        } catch {
          console.log('\n==================================================');
          console.log('SESSION RE-LOGIN TIMED OUT');
          console.log('Could not restore session within 90 seconds.');
          console.log('Email checks are paused. Restart the agent to try again.');
          console.log('==================================================\n');
          return false;
        }
      }

      return true;
    } catch (e) {
      console.log('[SESSION] Health check failed:', e.message);
      return false;
    }
  }

  async getUnreadEmails() {
    console.log('[NAVIGATOR] Initializing email extraction...');
    const unreadEmails = [];
    const maxEmails = config.monitoring?.maxEmailsPerCheck || 10;

    try {
      const sessionOk = await this.checkSession();
      if (!sessionOk) {
        return unreadEmails;
      }

      const currentUrl = this.page.url();
      if (currentUrl.includes('login.microsoftonline.com') || currentUrl.includes('login.live.com')) {
        return unreadEmails;
      }

      await this._waitForEmailList();

      const emails = await this.page.evaluate((maxEmails) => {
        // Outlook uses role="listbox" + role="option" for the email list
        const options = Array.from(document.querySelectorAll('[role="listbox"] [role="option"]'));
        const unreadOptions = options.filter(o => (o.getAttribute('aria-label') || '').toLowerCase().includes('unread'));
        const toProcess = (unreadOptions.length > 0 ? unreadOptions : options).slice(0, maxEmails);

        console.log('[evaluate] total options:', options.length, '| unread:', unreadOptions.length, '| processing:', toProcess.length);

          return toProcess.map(o => {
          // aria-label format: "Unread [Has attachments] SENDER SUBJECT TIME PREVIEW..."
          const ariaLabel = o.getAttribute('aria-label') || '';
          const lines = (o.innerText || '').trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
          // innerText lines: [sender, subject, time, preview...]
          const sender = lines[0] || 'Unknown';
          const subject = lines[1] || '(No subject)';
          // lines[2] is the timestamp shown in the list (e.g. "12:29" or "Mon" or "Mar 5")
          const time = lines[2] || '';
          const preview = ariaLabel; // full aria-label has all content for classification
          return { sender, subject, time, preview, ariaLabel };
        });
      }, maxEmails);

      console.log(`[NAVIGATOR] Found ${emails.length} unread emails via DOM query`);

      for (const email of emails) {
        try {
          // Click the option row to open reading pane
          await this.page.evaluate((subject) => {
            const opts = Array.from(document.querySelectorAll('[role="listbox"] [role="option"]'));
            const target = opts.find(o => (o.innerText || '').includes(subject));
            if (target) target.click();
          }, email.subject);

          await this.page.waitForTimeout(2000);

          // Reading pane body - use aria-label on region or fallback to any region
          const bodyContent = await this.page.evaluate(() => {
            const selectors = [
              '[role="region"][aria-label*="Message"]',
              '[role="region"][aria-label*="message"]',
              '[id*="ReadingPane"]',
              '[data-automation-id*="ReadingPane"]',
              '[class*="MessageRoot"]',
              '[role="main"] [role="region"]',
              // Broader fallbacks for different Outlook versions
              '[data-automation-id="ReadingPaneContent"]',
              '[data-automation-id*="message"]',
              '[class*="readingPane"]',
              '[class*="ReadingPane"]',
              '[class*="message-body"]',
              '[class*="messageBody"]',
              'div[class*="body"][class*="message"]',
              // Last resort: biggest text block in [role="main"]
              '[role="main"]',
            ];
            for (const sel of selectors) {
              const pane = document.querySelector(sel);
              if (pane && (pane.innerText || '').trim().length > 20) {
                return pane.innerText.substring(0, 5000).trim();
              }
            }
            // Absolute fallback: find the element in [role="main"] with the most text
            const main = document.querySelector('[role="main"]');
            if (main) {
              let best = null;
              let bestLen = 0;
              for (const el of main.querySelectorAll('div, article, section')) {
                const t = (el.innerText || '').trim();
                if (t.length > bestLen) { bestLen = t.length; best = t; }
              }
              if (best && bestLen > 20) return best.substring(0, 5000);
            }
            return '(Body not extracted)';
          });

          unreadEmails.push({
            sender: email.sender,
            subject: email.subject,
            body: bodyContent,
            // Use the timestamp shown in the email list row (stable across cycles)
            // rather than now() so the dedup key in main.js stays consistent
            date: email.time || email.subject,
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
    console.log(`Saving draft for: "${email.subject}"`);

    try {
      const clicked = await this.page.evaluate((subject) => {
        const opts = Array.from(document.querySelectorAll('[role="listbox"] [role="option"]'));
        const target = opts.find(o => (o.innerText || '').includes(subject));
        if (target) { target.click(); return true; }
        return false;
      }, email.subject);

      if (!clicked) {
        console.log('[DRAFT] Could not find email row to click');
        return false;
      }

      await this.page.waitForTimeout(2000);

      // Click Reply button in the reading pane (not the toolbar)
      // Reading pane reply is inside [role="region"] or near the message header
      const replySelectors = [
        '[role="region"] button[aria-label="Reply"]',
        '[role="region"] button[aria-label*="Reply"]',
        'button[aria-label="Reply"][data-unique-id]',
        'button[aria-label="Reply"]',
      ];

      let replyClicked = false;
      for (const sel of replySelectors) {
        const btns = this.page.locator(sel);
        const count = await btns.count();
        if (count > 0) {
          // Pick the last one - toolbar Reply is first, reading pane Reply is last
          await btns.last().click({ force: true });
          replyClicked = true;
          console.log(`[DRAFT] Clicked reply via: ${sel} (last of ${count})`);
          break;
        }
      }

      if (!replyClicked) {
        console.log('[DRAFT] Reply button not found');
        return false;
      }

      await this.page.waitForTimeout(2000);

      // Find the reply compose area
      const editorSelectors = [
        '[role="textbox"][aria-label*="Message body"]',
        '[contenteditable="true"][aria-label*="Message body"]',
        '[role="textbox"]',
        '[contenteditable="true"]',
      ];

      let editorFilled = false;
      for (const sel of editorSelectors) {
        const editor = this.page.locator(sel).first();
        if (await editor.count() > 0) {
          await editor.click({ force: true });
          await this.page.waitForTimeout(300);
          // Select all existing content and delete it first
          await this.page.keyboard.press('Control+A');
          await this.page.waitForTimeout(200);
          await this.page.keyboard.press('Delete');
          await this.page.waitForTimeout(200);
          // Use keyboard.type() instead of fill() - fill() bypasses Outlook's
          // React/Angular input event handlers so the body appears empty on save.
          // keyboard.type() fires real keydown/keypress/input/keyup events that
          // Outlook's editor framework actually listens to.
          await this.page.keyboard.type(replyDraft, { delay: 10 });
          editorFilled = true;
          console.log(`[DRAFT] Filled reply via keyboard.type(): ${sel}`);
          break;
        }
      }

      if (!editorFilled) {
        console.log('[DRAFT] Reply editor not found');
        return false;
      }

      // Give Outlook time to register the typed content before saving
      await this.page.waitForTimeout(2000);

      // Save as draft - try explicit save button first
      const saveSelectors = [
        'button[aria-label*="Save draft"]',
        'button[title*="Save draft"]',
        '[data-testid="saveDraftButton"]',
      ];

      let explicitlySaved = false;
      for (const sel of saveSelectors) {
        const btn = this.page.locator(sel).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          await btn.click();
          explicitlySaved = true;
          console.log('[DRAFT] Explicit save clicked');
          await this.page.waitForTimeout(1500);
          break;
        }
      }

      if (explicitlySaved) {
        // Draft is saved — close the compose window.
        // IMPORTANT: if Outlook shows a "Discard draft?" dialog after pressing Escape,
        // we must NOT click "Discard" (that deletes the draft we just saved).
        // We should click "Save" or "Keep" to preserve it, or just close the dialog
        // with Escape again.
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(800);

        // Check what dialog appeared (if any)
        const discardBtn = this.page.locator(
          'button[aria-label*="Discard"], button:has-text("Discard"), button[data-testid*="discard"]'
        ).first();
        const keepBtn = this.page.locator(
          'button[aria-label*="Keep"], button:has-text("Keep editing"), button:has-text("Keep")'
        ).first();
        const saveDialogBtn = this.page.locator(
          'button[aria-label*="Save"], button:has-text("Save")'
        ).first();

        if (await keepBtn.count() > 0 && await keepBtn.isVisible()) {
          // "Keep editing" dialog appeared — draft was NOT re-saved by explicit button.
          // Click Keep, wait for auto-save, then close.
          await keepBtn.click();
          console.log('[DRAFT] Kept compose open; waiting for auto-save...');
          await this.page.waitForTimeout(3000);
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(800);
        } else if (await saveDialogBtn.count() > 0 && await saveDialogBtn.isVisible()) {
          // A "Save" button is in the dialog — click it to confirm save
          await saveDialogBtn.click();
          console.log('[DRAFT] Clicked Save in dialog');
          await this.page.waitForTimeout(800);
        } else if (await discardBtn.count() > 0 && await discardBtn.isVisible()) {
          // "Discard" dialog appeared after explicit save — this means Outlook is
          // asking about unsaved changes, but we already saved explicitly.
          // Do NOT click Discard. Press Escape to dismiss the dialog without discarding.
          await this.page.keyboard.press('Escape');
          console.log('[DRAFT] Dismissed discard dialog with Escape (draft already saved)');
          await this.page.waitForTimeout(500);
        }
      } else {
        // No explicit save button found — rely on Outlook's auto-save-on-close.
        // Use Ctrl+S as keyboard shortcut to save first.
        await this.page.keyboard.press('Control+S');
        await this.page.waitForTimeout(1500);
        console.log('[DRAFT] Used Ctrl+S to save draft');

        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(800);

        // Handle "Discard draft?" dialog — click "Keep editing" so the draft is kept
        const keepBtn = this.page.locator(
          'button[aria-label*="Keep"], button:has-text("Keep editing"), button:has-text("Keep")'
        ).first();
        if (await keepBtn.count() > 0 && await keepBtn.isVisible()) {
          await keepBtn.click();
          console.log('[DRAFT] Kept compose open after dialog; waiting for auto-save...');
          await this.page.waitForTimeout(3000);
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(800);
        }
      }

      console.log('Draft saved successfully');
      return true;

    } catch (e) {
      console.log(`Error saving draft: ${e.message}`);
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(500);
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
