# Testing Juror Feature

## Test 1: Check if API Returns Jurors

Open your browser console and run this:

```javascript
// Replace with your case's scheduled date (format: YYYY-MM-DD)
const testDate = '2025-01-06'; // Example date

fetch(`http://localhost:5000/api/admin/calendar/cases-by-date?date=${testDate}`, {
  headers: {
    'Authorization': `Bearer YOUR_ADMIN_TOKEN_HERE`
  }
})
.then(r => r.json())
.then(data => {
  console.log('Cases:', data.cases);
  data.cases.forEach(c => {
    console.log(`Case: ${c.CaseTitle}`);
    console.log(`  Witnesses: ${c.witnesses.length}`);
    console.log(`  Jurors: ${c.jurors.length}`);
    if (c.jurors.length > 0) {
      console.log('  Juror Details:', c.jurors);
    }
  });
});
```

## Test 2: Create Test Juror Application Manually

If you have database access, insert a test juror:

```sql
-- Step 1: Create a test juror
INSERT INTO dbo.Jurors (Name, Email, County, State, PhoneNumber, AgeRange, Gender, IsVerified)
VALUES ('Test Juror', 'testjuror@test.com', 'Anderson', 'WASHINGTON', '123-456-7890', '25-34', 'Male', 1);

-- Get the JurorId that was just created
DECLARE @JurorId INT = SCOPE_IDENTITY();

-- Step 2: Create application for your case (replace YOUR_CASE_ID)
INSERT INTO dbo.JurorApplications (JurorId, CaseId, Status, AppliedAt)
VALUES (@JurorId, YOUR_CASE_ID, 'pending', GETDATE());
```

## Expected Result

After creating a juror application, when you view the case in admin dashboard, you should see:

```
Jurors (1)
Name             Email                   Location              Status    Actions
Test Juror       testjuror@test.com     Anderson, WASHINGTON  Pending   [Delete]
```

## Troubleshooting

1. **Still showing 0?**
   - Check browser console for errors
   - Check backend logs
   - Verify backend server restarted
   - Check Network tab to see API response

2. **Error fetching data?**
   - Make sure backend is running on correct port
   - Check CORS settings
   - Verify admin authentication token is valid

3. **API returns empty jurors array?**
   - The case genuinely has no juror applications yet
   - Feature is working correctly, just needs data
