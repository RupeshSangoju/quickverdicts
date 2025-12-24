# Timezone Fix Testing Guide

## Overview
This fix ensures that trial scheduling works correctly regardless of the attorney's timezone. Previously, when an attorney in India scheduled a trial for 6:30 AM local time, the system was treating it as 6:30 AM UK time, causing a ~5.5 hour delay.

## Changes Made

### 1. Frontend Changes (`frontend/app/attorney/state/schedule-trail/page.tsx`)
- Captures attorney's timezone offset using `new Date().getTimezoneOffset()`
- Captures timezone name using `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Sends both `timezoneOffset` and `timezoneName` to backend along with scheduled date/time

### 2. Backend Changes (`backend/models/Case.js`)
- Accepts `timezoneOffset` and `timezoneName` from frontend
- Converts attorney's local time to UTC before storing in database
- Logs the conversion for debugging: `Attorney Local → UTC`

### 3. Scheduler Changes (`backend/jobs/trialScheduler.js`)
- Removed timezone offset calculation based on attorney state
- Now uses `GETUTCDATE()` instead of `GETDATE()` for comparisons
- Compares UTC times directly (no conversion needed)

## How It Works

### Example: India Timezone (UTC+5:30)
1. **Attorney schedules:**
   - Local time: 2025-12-23 06:30 AM (India)
   - Timezone offset: +330 minutes (5.5 hours ahead of UTC)

2. **Backend converts:**
   - UTC time: 2025-12-23 01:00 AM
   - Stores: `ScheduledDate = '2025-12-23'`, `ScheduledTime = '01:00:00'`

3. **Scheduler triggers:**
   - At 2025-12-23 00:00 AM UTC → Opens war room (1 hour before)
   - At 2025-12-23 00:30 AM UTC → Sends notifications (30 min before)
   - At 2025-12-23 01:00 AM UTC → Trial starts
   - This corresponds to 6:30 AM India time ✅

## Testing Commands

### Test 1: Verify Timezone Conversion Logic
Run the timezone conversion test script:

```bash
cd backend
node test-timezone-conversion.js
```

This will show you how different timezones are converted to UTC:
- India (UTC+5:30)
- US Eastern (UTC-5)
- US Pacific (UTC-8)
- UK (UTC+0)
- Australia (UTC+11)

### Test 2: Check Database Directly (SQL Server)
If you have access to the SQL Server database, run the test queries:

```bash
# Connect to your SQL Server and run:
# backend/test-scheduler-query.sql
```

This will show:
1. Current UTC time vs server local time
2. All upcoming trials with time calculations
3. Cases ready for war room access
4. Cases ready for notifications

### Test 3: End-to-End Testing in Browser

#### Step 1: Check Your Timezone
Open browser console and run:
```javascript
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('Offset (minutes):', new Date().getTimezoneOffset());
console.log('Offset (hours):', new Date().getTimezoneOffset() / -60);
```

#### Step 2: Schedule a Test Trial
1. Login as attorney
2. Create a new case
3. Schedule it for a time ~10 minutes from now
4. Open browser console during scheduling
5. Look for logs:
   ```
   📍 Attorney timezone info: { timezoneName, timezoneOffset, localTime, scheduledDate }
   📤 Submitting case creation request: { ..., timezoneOffset, timezoneName }
   ```

#### Step 3: Check Backend Logs
Monitor backend console for conversion logs:
```
⏰ Attorney Local Time: 2025-12-23 06:30
🌍 Timezone Offset: 330 minutes (Asia/Kolkata)
🌐 Converted to UTC: 2025-12-23 01:00:00
   → Attorney Local: 2025-12-23 06:30 (Asia/Kolkata)
   → UTC Time: 2025-12-23 01:00:00
```

#### Step 4: Verify Scheduler
Check that the scheduler triggers at the correct time:
- War room should open ~1 hour before trial (in UTC)
- Notifications should send ~30 minutes before trial (in UTC)
- Trial should start at the exact UTC time

### Test 4: Quick Verification Commands

Check if user timezone is being captured correctly:
```bash
# In your browser console (F12)
const offset = new Date().getTimezoneOffset();
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(`Your timezone: ${timezone}, Offset: ${-offset} minutes from UTC`);
```

Calculate UTC time from your local time:
```bash
# In Node.js or browser console
const localDate = '2025-12-23';
const localTime = '06:30';
const timezoneOffset = -330; // Your offset (India = -330)

const localDateTime = new Date(`${localDate}T${localTime}:00`);
const utcDateTime = new Date(localDateTime.getTime() - (timezoneOffset * 60 * 1000));
console.log('Local:', localDateTime.toISOString());
console.log('UTC:', utcDateTime.toISOString());
```

## Expected Results

### Before the Fix
- Attorney in India schedules for 6:30 AM local time
- System stores 6:30 AM as-is
- Scheduler treats it as 6:30 AM UK time
- War room opens at 6:30 AM UK time = 12:00 PM India time ❌ (5.5 hours late)

### After the Fix
- Attorney in India schedules for 6:30 AM local time
- System converts to 1:00 AM UTC and stores
- Scheduler triggers at 1:00 AM UTC
- War room opens at 1:00 AM UTC = 6:30 AM India time ✅ (on time)

## Troubleshooting

### Issue: Times are still wrong
1. Check frontend console for timezone info being sent
2. Check backend logs for conversion happening
3. Verify database has UTC times stored
4. Check scheduler is using GETUTCDATE()

### Issue: Can't see conversion logs
1. Make sure backend console is visible
2. Check LOG_LEVEL environment variable
3. Look for logs with emojis: ⏰, 🌍, 🌐

### Issue: Scheduler not triggering
1. Verify scheduler is running (should see logs every 60 seconds)
2. Check case status is 'awaiting_trial' or 'join_trial'
3. Check admin approval status is 'approved'
4. Run the SQL test queries to see if cases are detected

## Database Schema Note

The `Cases` table stores:
- `ScheduledDate` (DATE) - in UTC
- `ScheduledTime` (VARCHAR) - in UTC, format: HH:MM:SS

No database schema changes were required for this fix.

## Backward Compatibility

**Important:** Cases scheduled before this fix may have incorrect times stored. You may need to:
1. Identify old cases with local times instead of UTC
2. Manually convert and update them
3. Or mark them for rescheduling

```sql
-- Find cases scheduled in the future that might have wrong times
SELECT CaseId, CaseTitle, ScheduledDate, ScheduledTime, AttorneyId
FROM Cases
WHERE ScheduledDate >= CAST(GETUTCDATE() AS DATE)
  AND AttorneyStatus IN ('awaiting_trial', 'join_trial')
ORDER BY ScheduledDate, ScheduledTime;
```

## Support

If you encounter issues:
1. Check browser console for timezone capture
2. Check backend logs for conversion
3. Run the test scripts provided
4. Verify database times are in UTC
5. Check scheduler logs for trigger events
