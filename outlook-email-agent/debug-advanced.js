/**
 * ADVANCED DEBUG SCRIPT: Inspect Outlook DOM more thoroughly
 * Usage: node debug-advanced.js
 */

const { chromium } = require('playwright');
const path = require('path');

async function advancedDebug() {
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

    console.log('\n=== ADVANCED DOM INSPECTION ===\n');

    const analysis = await page.evaluate(() => {
      console.log('Looking for email-like elements...');

      // Strategy 1: Find all divs with substantial text that look like emails
      const allDivs = Array.from(document.querySelectorAll('div'));
      
      const emailCandidates = [];
      
      for (const div of allDivs) {
        const text = div.textContent || '';
        const lines = text.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0);
        
        // Look for pattern: sender line, subject line, preview line
        if (lines.length >= 2 && lines.length <= 10) {
          // Check if first line looks like email or name
          const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(lines[0]);
          const looksLikeName = /^[A-Z][a-z]+ [A-Z][a-z]+/.test(lines[0]) ||
                              /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z]/.test(lines[0]);
          
          // Check if second line could be a subject
          const looksLikeSubject = lines[1].length > 5 && lines[1].length < 150;
          const notNavigation = !lines[1].includes(':') && !lines[1].includes('/');
          
          if ((hasEmail || looksLikeName) && looksLikeSubject && notNavigation) {
            emailCandidates.push({
              tagName: div.tagName,
              className: div.className?.substring(0, 100) || '',
              role: div.getAttribute('role') || '',
              lines: lines.slice(0, 5),
              hasEmail,
              looksLikeName,
              styles: {
                fontWeight: div.style?.fontWeight || '',
                color: div.style?.color || '',
                backgroundColor: div.style?.backgroundColor || ''
              },
              html: div.outerHTML.substring(0, 500)
            });
          }
        }
      }

      // Strategy 2: Look for elements with onclick or that are clickable
      const clickableElements = Array.from(document.querySelectorAll('[onclick], [role="button"], [data-automation-id]'))
        .slice(0, 10)
        .map(el => ({
          tagName: el.tagName,
          className: el.className?.substring(0, 100) || '',
          role: el.getAttribute('role') || '',
          hasOnclick: !!el.onclick,
          dataAutomationId: el.getAttribute('data-automation-id') || '',
          text: el.textContent?.substring(0, 80) || ''
        }));

      // Strategy 3: Check what's in the main container
      const mainContainerEl = document.querySelector('[role="main"], main');
      const mainContent = mainContainerEl ? {
        tagName: mainContainerEl.tagName,
        className: mainContainerEl.className?.substring(0, 100) || '',
        childrenCount: mainContainerEl.children?.length || 0,
        directChildren: Array.from(mainContainerEl.children).slice(0, 5).map(child => ({
          tagName: child.tagName,
          className: child.className?.substring(0, 80) || '',
          textPreview: child.textContent?.substring(0, 50) || ''
        }))
      } : null;

      // Strategy 4: Look for list containers
      const listContainers = Array.from(document.querySelectorAll('[role="list"], [role="grid"], [role="table"]'))
        .slice(0, 5)
        .map(container => ({
          tagName: container.tagName,
          className: container.className?.substring(0, 100) || '',
          role: container.getAttribute('role') || '',
          childCount: container.children?.length || 0
        }));

      // Strategy 5: Find all elements with text that contain email addresses or look like subjects
      const allElements = Array.from(document.querySelectorAll('*'));
      const subjectLike = allElements
        .filter(el => {
          const text = el.textContent || '';
          return text.length > 10 && text.length < 200 && 
                 text.split('\n').length < 5 &&
                 !text.includes(':') &&
                 !text.includes('Outlook') &&
                 !text.includes('email') &&
                 !text.includes('Create');
        })
        .slice(0, 15)
        .map(el => ({
          tagName: el.tagName,
          className: el.className?.substring(0, 100) || '',
          text: el.textContent?.substring(0, 100) || ''
        }));

      return {
        emailCandidates: emailCandidates.slice(0, 10),
        clickableElements,
        mainContainer: mainContent,
        listContainers,
        subjectLike
      };
    });

    console.log(JSON.stringify(analysis, null, 2));

    console.log('\n=== KEY FINDINGS ===');
    console.log(`1. Email candidates found: ${analysis.emailCandidates.length}`);
    console.log(`2. Clickable elements: ${analysis.clickableElements.length}`);
    console.log(`3. Main container: ${analysis.mainContainer?.className}`);
    console.log(`4. List containers: ${analysis.listContainers.length}`);
    console.log(`5. Subject-like elements: ${analysis.subjectLike.length}`);

    if (analysis.emailCandidates.length > 0) {
      console.log('\n=== EMAIL CANDIDATES ===');
      analysis.emailCandidates.forEach((c, i) => {
        console.log(`${i + 1}. ${c.className}`);
        console.log(`   Text: ${c.lines.join(' | ')}`);
        console.log(`   Font: ${c.styles.fontWeight}, Color: ${c.styles.color}`);
        console.log(`   HTML: ${c.html.substring(0, 200)}...`);
      });
    }

    console.log('\nPress Enter to close...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'debug-error.png' });
  } finally {
    await browser.close();
  }
}

advancedDebug();
