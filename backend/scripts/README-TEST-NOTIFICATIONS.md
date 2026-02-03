# Creating 71 Test Notifications for Pagination Testing

This guide explains how to create 71 test notifications to test the pagination feature (50 notifications on page 1, 21 on page 2).

## Overview

The pagination is configured with **50 items per page**, so 71 notifications will span exactly 2 pages:
- **Page 1**: 50 notifications
- **Page 2**: 21 notifications

## Methods to Create Test Notifications

### Method 1: Using the API Endpoint (Recommended)

**Prerequisites:**
- Backend server must be running
- You must be logged in (have a valid JWT token)
- Server must be in development mode (not production)

**Steps:**

1. **Start your backend server:**
   ```bash
   cd /home/user/quickverdicts/backend
   npm start
   ```

2. **Call the test endpoint:**

   **Using curl:**
   ```bash
   curl -X POST http://localhost:5000/api/notifications/test/create-71 \
     -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
     -H "Content-Type: application/json"
   ```

   **Using Postman or Thunder Client:**
   - Method: `POST`
   - URL: `http://localhost:5000/api/notifications/test/create-71`
   - Headers:
     - `Authorization: Bearer YOUR_JWT_TOKEN_HERE`
     - `Content-Type: application/json`

3. **Response:**
   ```json
   {
     "success": true,
     "message": "Successfully created 71 test notifications",
     "details": {
       "userId": 1,
       "userType": "attorney",
       "totalCreated": 71,
       "pagination": {
         "page1": "50 notifications",
         "page2": "21 notifications"
       }
     }
   }
   ```

**Advantages:**
- ✅ Uses your actual logged-in user ID
- ✅ No need to manually configure user ID
- ✅ Respects user permissions
- ✅ Automatically uses correct user type (attorney/juror)

---

### Method 2: Using the SQL Script

**Prerequisites:**
- Access to your SQL Server database
- SQL Server Management Studio or Azure Data Studio

**Steps:**

1. **Open the SQL script:**
   ```
   /home/user/quickverdicts/backend/scripts/create-71-notifications.sql
   ```

2. **Modify the variables at the top:**
   ```sql
   DECLARE @UserId INT = 1;           -- Change to your test user ID
   DECLARE @UserType NVARCHAR(50) = 'attorney';  -- Change to 'attorney', 'juror', or 'admin'
   ```

3. **Run the script in your SQL Server database**

4. **Verify the results:**
   The script will output:
   ```
   ✓ Successfully created 71 notifications
     - Page 1 will show: 50 notifications
     - Page 2 will show: 21 notifications
   ```

**Advantages:**
- ✅ Works even if backend is not running
- ✅ Direct database access
- ✅ Can specify any user ID and type

---

### Method 3: Using the Node.js Script

**Prerequisites:**
- Backend dependencies installed (`npm install`)
- Database configured in `.env` file
- Valid database credentials

**Steps:**

1. **Configure your environment:**
   Create or update `/home/user/quickverdicts/backend/.env` with:
   ```env
   DB_SERVER=your_server
   DB_NAME=your_database
   DB_USER=your_username
   DB_PASSWORD=your_password
   ```

2. **Modify the script (optional):**
   Edit `/home/user/quickverdicts/backend/scripts/create-test-notifications.js`:
   ```javascript
   const userId = 1;                    // Change to your test user ID
   const userType = USER_TYPES.ATTORNEY; // Change to JUROR or ADMIN
   ```

3. **Run the script:**
   ```bash
   cd /home/user/quickverdicts/backend
   node scripts/create-test-notifications.js
   ```

4. **Output:**
   ```
   Creating 71 test notifications...
   ✓ Successfully created 71 notifications
     User ID: 1
     User Type: attorney
     Distribution:
       - Page 1: 50 notifications
       - Page 2: 21 notifications
   ```

**Advantages:**
- ✅ Programmatic approach
- ✅ Can be automated or integrated into tests
- ✅ Uses existing Notification model

---

## Verification

After creating the notifications, verify the pagination:

1. **Navigate to the notifications page** in your frontend:
   - Attorney: `/attorney/notifications` or check the notifications section
   - Juror: `/juror/notifications` or check the notifications section

2. **Check pagination:**
   - You should see "Page 1 of 2"
   - Page 1 should display 50 notifications
   - Click "Next" or "2" to go to page 2
   - Page 2 should display 21 notifications

3. **API verification:**
   ```bash
   # Get page 1 (notifications 1-50)
   curl "http://localhost:5000/api/notifications?limit=50&offset=0" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"

   # Get page 2 (notifications 51-71)
   curl "http://localhost:5000/api/notifications?limit=50&offset=50" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## Notification Types Created

The script creates a variety of notification types:
1. Case Submitted
2. Application Received
3. War Room Ready
4. Verdict Required
5. Case Approved
6. Trial Starting Soon
7. Payment Processed
8. Verdict Submitted
9. Case Completed
10. Account Verified

These types cycle through all 71 notifications to provide realistic test data.

## Cleanup

To delete all test notifications:

**SQL:**
```sql
DELETE FROM dbo.Notifications
WHERE Title LIKE '%#%' AND Message LIKE '%(Test notification%)%';
```

**API:** (if available)
Use the bulk delete endpoint or delete notifications individually through the UI.

## Troubleshooting

### "Database configuration incomplete"
- Ensure your `.env` file has all required database credentials
- Check that the database server is accessible

### "Cannot find module 'mssql'"
- Run `npm install` in the backend directory

### "Test endpoints not available in production"
- Ensure `NODE_ENV` is not set to `production`
- Set it to `development` in your `.env` file

### No notifications showing up
- Verify the user ID matches your logged-in user
- Check that the user type is correct (attorney/juror/admin)
- Ensure database connection is working

## Notes

- All test notifications are created with `IsRead = 0` (unread status)
- Timestamps are staggered to show realistic chronological order
- First 50 notifications have associated case IDs
- Each notification includes a unique number (#1-#71) for easy identification
