# Debug Guide: Deleted Cases Reappearing

## Step 1: Restart Backend Server (CRITICAL!)

The code changes won't take effect until you restart the backend server.

```bash
# Stop the backend (Ctrl+C if running in terminal, or kill the process)
# Then restart it:
cd /home/user/quickverdicts/backend
npm start
# OR
node server.js
```

## Step 2: Verify Database Deletion

Check if the case is actually marked as deleted in the database:

```sql
-- Connect to your database and run:
SELECT CaseId, CaseTitle, IsDeleted, AdminApprovalStatus, AttorneyStatus
FROM dbo.Cases
WHERE CaseId = <YOUR_DELETED_CASE_ID>;

-- IsDeleted should be 1
-- If it's 0, the deletion didn't work
```

## Step 3: Clear Browser Cache

Sometimes the browser caches API responses:

1. Open DevTools (F12)
2. Go to Network tab
3. Check "Disable cache"
4. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

## Step 4: Monitor Network Requests

1. Open DevTools (F12)
2. Go to Network tab
3. Delete a case
4. Watch for these requests:
   - DELETE /api/admin/cases/:id/delete (should return success)
   - GET /api/admin/calendar/cases-by-date (should NOT return deleted case)
   - GET /api/admin/trials/ready (should NOT return deleted case)
   - GET /api/admin/stats/comprehensive (should NOT count deleted case)

## Step 5: Check Backend Logs

Look for these log messages when you delete a case:

```
✅ Admin <adminId> deleted case <caseId> - "<CaseTitle>"
📧 Sent X notifications for deleted case <caseId>
```

## Step 6: Test Specific Case ID

Replace `<CASE_ID>` with your actual deleted case ID and test:

```bash
# Test if the backend returns the deleted case
curl -H "Authorization: Bearer <YOUR_TOKEN>" \
  http://localhost:4000/api/admin/cases/<CASE_ID>

# Should return 404 or show IsDeleted: 1
```

## Common Issues:

### Issue 1: Backend Not Restarted
**Solution**: Restart backend server (Step 1)

### Issue 2: Browser Cache
**Solution**: Clear cache and hard refresh (Step 3)

### Issue 3: Database Not Updated
**Solution**: Check if softDeleteCase is being called. Look for error logs.

### Issue 4: Multiple Backend Instances
**Solution**: Make sure only ONE backend instance is running:
```bash
# Check for multiple node processes
ps aux | grep node
# Kill old instances if needed
```

## Quick Test:

1. Restart backend
2. Clear browser cache
3. Delete a test case
4. Wait 35 seconds (auto-refresh is every 30 seconds)
5. Case should stay deleted

If it still reappears, check the Network tab to see which endpoint is returning it.
