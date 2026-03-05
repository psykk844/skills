/**
 * DEBUG SCRIPT: Run this to inspect Outlook DOM structure
 * Usage: node debug-email-extraction.js
 */

const { chromium } = require('playwright');
const path = require('path');

async function debugEmailExtraction() {
  const userDir = path.join(__dirname, 'playwright-profile');

  const browser = await chromium.launchPersistentContext(userDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });

  const page = browser.pages()[0] || (await browser.newPage());

  try {
    console.log('Navigate to Outlook inbox...');
    await page.goto('https://outlook.cloud.microsoft/mail/inbox', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    console.log('\n=== INSPECTING OUTLOOK DOM STRUCTURE ===\n');

    const structure = await page.evaluate(() => {
      const analysis = {
        activeElement: document.activeElement?.tagName,
        emailRows: [],
        readingPane: null,
        unreadIndicators: []
      };

      const rows = Array.from(
        document.querySelectorAll('[role="listitem"], [role="row"]')
      ).slice(0, 5);

      for (const row of rows) {
        const classes = row.className || '';
        const ariaLabel = row.getAttribute('aria-label') || '';
        const text = row.innerText?.substring(0, 80) || '';

        analysis.emailRows.push({
          role: row.getAttribute('role'),
          classes: classes.substring(0, 100),
          ariaLabel: ariaLabel.substring(0, 100),
          textPreview: text,
          hasUnreadClass: classes.includes('unread'),
          hasBlueIndicator: !!row.querySelector('[class*="blue"]')
        });

        const indicator = row.querySelector('[class*="unread"], [class*="blue"]');
        if (indicator) {
          analysis.unreadIndicators.push({
            type: indicator.className,
            style: indicator.getAttribute('style')
          });
        }
      }

      const paneSelectors = [
        '[id*="ReadingPane"]',
        '[role="region"][aria-label*="Message"]',
        '[data-automation-id*="ReadingPane"]',
        '[class*="MessageRoot"]'
      ];

      for (const selector of paneSelectors) {
        const pane = document.querySelector(selector);
        if (pane) {
          analysis.readingPane = {
            selector,
            found: true,
            textLength: pane.innerText?.length || 0,
            className: pane.className?.substring(0, 100)
          };
          break;
        }
      }

      return analysis;
    });

    console.log(JSON.stringify(structure, null, 2));

    console.log(
      '\n✅ Analysis complete. Review the structure above to update selectors.'
    );
    console.log(
      'Look for: unread class names, aria-label patterns, reading pane selectors'
    );
    
    console.log('\nPress Enter to close...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugEmailExtraction();
