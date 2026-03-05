# Windows Task Scheduler Setup Guide

## Schedule
**Mon-Fri, 7am - 5pm Brisbane Time (UTC+10)**

## Prerequisites
- Email agent already set up and tested
- Outlook login completed via `npm run setup`

---

## Method 1: Using Task Scheduler (GUI)

### Step 1: Open Task Scheduler
- Press `Win + R`, type `taskschd.msc`, press Enter
- OR press `Win`, type "Task Scheduler", open it

### Step 2: Create Basic Task
1. Click **"Create Basic Task"** on the right (top option)
2. **Name:** `Outlook Email Agent`
3. **Description:** `Monitors emails 7am-5pm Brisbane time`
4. Click **Next**

### Step 3: Set Schedule
1. **When do you want the task to start?**
   - Select: **Daily**
   - Click **Next**

2. **What day and time...?**
   - **Start date:** Today
   - **Start time:** 7:00:00 AM
   - **Timezone:** Select **(UTC+10:00) Brisbane** from dropdown
   - **Recur every:** 1 day
   - Click **Next**

### Step 4: Set Action
1. **What action...?**
   - Select: **Start a program**
   - Click **Next**

### Step 5: Configure Action
1. **Program/script:**
   - Navigate to your Node.js installation
   - Usually: `C:\\Program Files\\nodejs\\node.exe`
   
2. **Add arguments:**
   - Full path to your main.js file
   - Example: `C:\\Users\\iamsp\\OneDrive\\Desktop\\Antigravity\\Antigravity_skills\\outlook-email-agent\\main.js`
   
3. **Start in (optional):**
   - Path to the outlook-email-agent folder
   - Example: `C:\\Users\\iamsp\\OneDrive\\Desktop\\Antigravity\\Antigravity_skills\\outlook-email-agent`

4. Click **Next**

### Step 6: Finish & Open Properties
1. Click **Finish**
2. Find your task "Outlook Email Agent" in the list
3. Right-click → **Properties**

### Step 7: Configure Advanced Settings

**Triggers Tab**
1. Click **"Edit"** on the trigger
2. **Begin the task:** At scheduled time
3. **Settings:**
   - ✅ Check: **"Repeat task every: 10 minutes"**
   - ✅ Check: **"for a duration of: 10 hours"**
   - ✅ Check: **"Stop if the task runs longer than: 6 hours"** (safety)
   - ✅ Check: **"Enabled"**
4. Click **OK**

**Conditions Tab**
1. **Power:** Uncheck "Start the task only if the computer is on AC power"
   - Uncheck "Stop if the computer switches to battery power"
   - This allows it to run on laptop battery

**Settings Tab**
1. ✅ Check: **"Allow task to be run on demand"**
2. ✅ Check: **"Run task as soon as possible after a scheduled start is missed"**
3. ✅ Check: **"Stop the task if it runs longer than:** 6 hours
4. ✅ Check: **"If the task fails, restart every** 5 minutes", **Attempt to restart up to:** 3 times

**OK** to save

---

## Method 2: Using Command Line (Faster)

Open **Command Prompt as Administrator** and run:

```cmd
schtasks /create /tn "Outlook Email Agent" /tr "node C:\\Users\\iamsp\\OneDrive\\Desktop\\Antigravity\\Antigravity_skills\\outlook-email-agent\\main.js" /sc daily /st 07:00 /du 10:00 /ri 10 /f
```

Then set the timezone trigger manually in GUI.

---

## Testing

**Manual Test:**
1. Right-click task → **"Run"**
2. Check if it starts successfully
3. Monitor Task Scheduler "Last Run Result" column

**Schedule Test:**
1. Set time to 6:58 AM (just before trigger)
2. Wait until 7:00 AM + check if task starts
3. Check Task Scheduler → "Task Scheduler Library" → "History" tab for logs

---

## Troubleshooting

**Task won't start:**
- Check "History" tab for error details
- Verify Node.js path is correct
- Try running `node main.js` manually in the folder first

**Task stops early:**
- Check "Stop if the task runs longer than" - increase to 12 hours

**Emails not being processed:**
- Open Task Scheduler → Find task → Right-click → Run
- Check if console window shows errors
- Verify .env file has correct API key

**Different timezone:**
- In Task Scheduler → Properties → Triggers → Select "(UTC+10:00) Brisbane"

---

## Stopping the Agent

**Option A: Disable scheduled task:**
1. Right-click task → **Disable**
2. Agent won't run until enabled again

**Option B: Delete task:**
1. Right-click → **Delete**
2. Agent won't run at all (need to recreate to start again)

**Option C: Stop running instance:**
1. Task Manager → Details tab
2. Find `node.exe` process
3. Right-click → End task
4. Next scheduled run will start fresh

---

## Logs

View logs in:
- **Task Scheduler:** "History" tab → Shows when task runs and any errors
- **Console output:** If visible, shows each email processed
- **Outlook:** Drafts folder for generated replies

---

## Summary

| Setting | Value |
| ---------- | ----- |
| Name | Outlook Email Agent |
| Schedule | Daily at 7:00 AM |
| Timezone | Brisbane (UTC+10) |
| Repeat | Every 10 minutes |
| Duration | 10 hours |
| Days | Mon-Fri (checked in next step) |

**Mon-Fri Only:** In Task Scheduler → Triggers tab → "Edit" → Check "Select weekdays" → Uncheck Sat/Sun if needed (but daily trigger with下班 will work as-is due to duration limit).

The agent will **automatically stop after 10 hours** (5 PM Brisbane), so it effectively runs only 7 AM - 5 PM daily.
