# Outlook Email Agent

AI-powered email agent that monitors your Outlook inbox, processes all emails, determines if a reply is needed, and drafts intelligent replies using Claude 3 Haiku.

## Features

- ✅ Monitor Outlook inbox automatically (every 10 minutes by default)
- ✅ Process **ALL emails** (not just urgent ones)
- ✅ Classify email importance (high/medium/low) based on sender, keywords, and content
- ✅ **Smart "No Reply Needed" detection** - tags informational emails automatically
- ✅ Generate AI-powered reply drafts using Claude 3 Haiku (via Anthropic)
- ✅ Save replies to Outlook Drafts folder for your review
- ✅ Runs in headless mode (invisible, no workflow interference)
- ✅ Persistent login session (login once, stays logged in)
- ✅ **Schedule support** - set working hours (e.g., 7am-5pm Mon-Fri)

## Prerequisites

- Node.js (v16 or higher)
- Anthropic API key (with Claude access)
- Outlook account (work or personal)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browser:
```bash
npx playwright install chromium
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Edit `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
OUTLOOK_EMAIL=your.email@domain.com
CHECK_INTERVAL_MINUTES=10
HEADLESS=true
```

## Setup (First Time Only)

Login to Outlook and save your session:

```bash
npm run setup
```

1. A browser window will open
2. Log in to your Outlook account
3. Complete any 2FA if required
4. Wait until you can see your inbox
5. Type `done` in the terminal and press Enter

Your login session is now saved locally and will persist between runs.

## Running the Agent

Start the email monitoring:

```bash
npm start
```

The agent will:
1. Check your inbox
2. Find **ALL unread emails**
3. Determine if a reply is needed (questions? requests? informational?)
4. If reply needed: Generate AI draft
5. If no reply needed: Tag as "(No reply needed)"
6. Save drafts to Drafts folder
7. Repeat every 10 minutes (configurable)

## Scheduled Execution (Working Hours Only)

Want the agent to run only during work hours (e.g., 7am-5pm Mon-Fri)?

**Use Windows Task Scheduler:**
1. See full setup guide: `TASK_SCHEDULER_SETUP.md`
2. Or automatically schedule using GUI with:
   - Daily at 7:00 AM Brisbane Time
   - Repeat every 10 minutes for 10 hours duration
   - Automatically stops at 5:00 PM

**Quick setup (Run as Administrator in CMD):**
```cmd
schtasks /create /tn "Outlook Email Agent" /tr "node path\\to\\main.js" /sc daily /st 07:00 /du 10:00 /ri 10 /f
```

Then configure timezone to Brisbane (UTC+10) in Task Scheduler.

## How It Works

1. **Email Classification**:
   - Analyzes ALL emails (not just urgent)
   - Scores importance (high/medium/low) based on keywords, sender, domain
   - **Detects if reply is needed** vs informational-only emails
   - Tags with "(No reply needed)" for FYI, auto-replies, newsletters

2. **AI Reply Generation**: Uses GLM-4.7 via SiliconFlow to:
   - Draft professional, concise replies
   - Address specific questions or requests
   - Match your specified tone
   - Include context from original email
   - Very cost-effective (~99% cheaper than alternatives)

3. **Draft Storage**: Reply drafts are saved to Outlook Drafts folder
   - Review drafts at your convenience
   - Edit if needed
   - Click Send when ready

## Configuration

Edit `config.js` to customize:

### Importance Criteria
- `urgentKeywords`: Words that trigger higher importance
- `clientDomains`: Domains of important clients
- `importantSenders`: High-priority email addresses
- `maxAgeHours`: Only process emails from recent timeframe

### AI Settings
- `openai.model`: claude-3-haiku-20240307 (via Anthropic)
- `openai.replyModel`: claude-3-haiku-20240307 (via Anthropic)
- `reply.tone`: Professional yet friendly

### Monitoring
- `checkIntervalMinutes`: How often to check inbox
- `maxEmailsPerCheck`: Max emails to process per cycle
- `checkUnreadOnly`: Only process unread emails

## Important Notes

### First Run
- Run `npm run setup` first to log in to Outlook
- Manual login required (supports 2FA)
- Session is saved locally

### Headless Mode
- Default: `HEADLESS=true` (runs invisible)
- Set `HEADLESS=false` to see browser window
- No interference with normal Outlook usage

### Session Expiration
- Outlook sessions expire after ~30-90 days
- Re-run `npm run setup` if you're logged out
- Supports 2FA on re-login

### Cost
- Anthropic Claude 3 Haiku: Very cost-effective for email replies
- Uses Haiku (fast, efficient model designed for tasks)
- Pro plan optional for high volume

## Troubleshooting

### "Login required" error
Run `npm run setup` to re-authenticate

### No drafts being created
- Check email: Is Anthropic API key valid?
- Check logs: Importance scores require 5+ for processing
- Adjust `urgentKeywords` in `config.js`

### Can't access work account
Some organizations block automation. Contact your IT department.

### Browser takes too long to load
- Reduce `setDefaultTimeout` in `outlookNavigator.js`
- Check your internet connection

## Stopping the Agent

Press `Ctrl+C` to stop monitoring gracefully.

## License

MIT
