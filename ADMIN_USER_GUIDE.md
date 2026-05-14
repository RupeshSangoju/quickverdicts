# Quick Verdicts — Admin User Guide

**For:** Quick Verdicts administrators
**Covers:** Login → managing attorneys & jurors → approving cases → monitoring live trials → post-trial

---

## What Does the Admin Do?

As an administrator you are the control center of the Quick Verdicts platform. Your responsibilities are:

- Verify attorney and juror accounts
- Approve or reject case submissions
- Manage the scheduling calendar (block/unblock dates and times)
- Handle reschedule requests
- Monitor live trials in real time
- Maintain records of all deleted accounts and cases

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Managing Attorneys](#3-managing-attorneys)
4. [Managing Jurors](#4-managing-jurors)
5. [Managing Cases](#5-managing-cases)
6. [Reschedule Requests](#6-reschedule-requests)
7. [Calendar & Schedule Management](#7-calendar--schedule-management)
8. [Monitoring Live Trials](#8-monitoring-live-trials)
9. [Notifications](#9-notifications)
10. [Deleted Records](#10-deleted-records)
11. [Common Questions](#11-common-questions)

---

## 1. Logging In

Go to the Quick Verdicts admin URL and log in with your admin email and password.

After logging in you land directly on the **Admin Dashboard**. The platform auto-logs you out after **20 minutes of inactivity** as a security measure.

> **Important:** Admin credentials are created by the system — there is no self-registration for admin accounts. Contact your system administrator if you need access.

---

## 2. Dashboard Overview

The dashboard is a single scrollable page divided into clearly labelled sections. At the top are five stat cards:

| Card | Shows |
|---|---|
| **Total Attorneys** | Number registered + how many are verified |
| **Total Jurors** | Number registered + how many are verified |
| **Pending Cases** | Cases submitted by attorneys awaiting your approval |
| **Active Trials** | Trials currently running live |
| **Notifications** | Count of unread notifications |

Below the stat cards the main sections appear in this order:

1. Pending Cases (requires your action)
2. Reschedule Requests (requires your action)
3. Attorneys table
4. Jurors table
5. Cases by date (calendar view)
6. Deleted Cases archive
7. Deleted Attorneys archive

Sections with action items are shown first so you always see what needs attention immediately.

---

## 3. Managing Attorneys

### Finding Attorneys

Scroll to the **Attorneys** section. You will see a paginated table with:

- Full name, email address, phone number
- Law firm name, state, state bar number
- Verification status badge (**Pending**, **Verified**, or **Declined**)
- Number of cases created (click to expand and see case IDs)
- Date the account was created

**Search:** Type in the search box to filter by name, email, law firm, or bar number.

**Filter by status:** Use the filter buttons — **All**, **Verified**, **Not Verified**, **Declined**.

**Sort:** Click any column header to sort ascending or descending (name, email, law firm, status, date, etc.).

---

### Verifying an Attorney

When an attorney signs up their status is **Pending**. They cannot submit cases until you verify them.

1. Find the attorney in the table
2. Click the **Verify** button (green checkmark icon)
3. Confirm the action

**What happens:**
- Status changes to **Verified**
- Attorney can now submit cases for approval
- Attorney does not receive an automatic email at this step (they see the status change in their dashboard)

---

### Declining an Attorney

If an attorney's credentials are incorrect or they do not meet requirements:

1. Find the attorney in the table
2. Click the **Decline** button (red X icon)
3. Optionally add a reason or comment
4. Confirm

**What happens:**
- Status changes to **Declined**
- Attorney cannot submit cases
- The attorney appears in the **Declined** filter view

> **Note:** Declining is not permanent. You can verify a declined attorney later if issues are resolved.

---

### Deleting an Attorney Account

Use this only when an account needs to be permanently removed (e.g., fraudulent registration):

1. Find the attorney in the table
2. Click the **Delete** (trash icon) button
3. Confirm the deletion in the dialog

**What happens:**
- The account is deactivated immediately
- The attorney receives an email: *"Your QuickVerdicts Account Has Been Deleted"*
- The attorney can no longer log in
- The record moves to the **Deleted Attorneys** archive (see [Section 10](#10-deleted-records))

> ⚠️ Deletion cannot be undone through the UI. The record is kept in the archive for reference only.

---

## 4. Managing Jurors

### Finding Jurors

Scroll to the **Jurors** section. The table shows:

- Full name, email address
- County and state
- Verification status (**Pending**, **Verified**, **Declined**)
- Onboarding status (whether they completed the intro video and quiz)
- Number of cases they have been approved for
- Date the account was created

**Search, filter, and sort** work the same way as the attorney table.

---

### Viewing a Juror's Eligibility Answers

During signup, jurors answer eligibility questions (age, citizenship, felony history, etc.). To review their answers:

1. Find the juror in the table
2. Click **View Criteria** (the info icon)
3. A popup shows each eligibility question and the juror's answer

Use this to confirm a juror meets the requirements before verifying them.

---

### Verifying a Juror

1. Find the juror in the table
2. Click **Verify**
3. Confirm

**What happens:**
- Status changes to **Verified**
- Juror can now view the job board and apply to cases

---

### Declining a Juror

1. Find the juror in the table
2. Click **Decline**
3. Optionally add a reason
4. Confirm

**What happens:**
- Status changes to **Declined**
- Juror cannot apply to cases

---

### Deleting a Juror Account

Same process as deleting an attorney. The juror receives a deletion email and can no longer log in. The record moves to the archive.

---

## 5. Managing Cases

### The Case Approval Flow

When an attorney submits a new case it appears in the **Pending Cases** section at the top of your dashboard. This is the most time-sensitive section — attorneys and jurors are waiting on your decision.

Each pending case card shows:
- Case title (auto-generated: "Plaintiff v. Defendant")
- Attorney name, email, phone, law firm
- Scheduled date and time
- County and state
- Case tier and description

---

### Viewing Full Case Details

Click **View Details** on any case to open the Case Details modal. This shows everything:

**Case Information**
- Case ID, title, type, jurisdiction, county, state
- Tier level, description
- Scheduled date and time

**Attorney Information**
- Name, email, phone, law firm

**Plaintiff and Defendant Groups**
- All parties and their mock legal representatives

**Witnesses**
- Name, side (Plaintiff / Defendant), email, description
- You can **delete a witness** from here if needed

**Jury Questions (Voir Dire)**
- All default disqualifying questions
- Attorney's custom questions with response type (Yes/No or Text)
- Download button for questions as a text file or MS Forms template

**Juror Applications**
- List of jurors who applied, with status (Pending, Approved, Rejected)
- Applied date
- You can **remove a juror application** from here if needed

**Team Members**
- Anyone the attorney added as a team member, with their role

---

### Approving a Case

1. In the pending case card, click **Approve**
2. The system automatically checks if the time slot is already booked

**Scenario A — No conflict:**
- Case is approved immediately
- Case appears on the juror job board
- Attorney receives a notification

**Scenario B — Time slot conflict:**
A **Conflict** dialog appears showing what is already booked at that time. You must provide **3 alternate time slots** for the attorney to choose from:
- Enter Date and Time for Option 1, 2, and 3
- Click **Send Reschedule Options**

The attorney receives an email with your 3 suggestions and picks one. The case stays **Pending** until they respond.

---

### Rejecting a Case

1. In the pending case card, click **Reject**
2. Select a rejection reason:

| Reason | When to use |
|---|---|
| Scheduling conflict | The requested slot conflicts with another booking |
| Invalid case details | Information provided is incorrect or incomplete |
| Missing documentation | Required supporting documents not provided |
| Jurisdictional issues | Case falls outside supported jurisdiction |
| Duplicate submission | Same case submitted more than once |
| Insufficient lead time | Not enough time before requested trial date |
| Other | Any other reason — must add a comment |

3. Optionally add comments to explain your decision
4. If rejecting due to scheduling conflict, you can suggest 3 alternate slots (same as approval conflict flow)
5. Click **Reject Case**

**What happens:**
- Case status changes to **Rejected**
- Attorney receives a notification with your reason and any comments
- Case is removed from the pending queue

---

### Admin-Initiated Case Reschedule

If you need to force a reschedule (e.g., system maintenance, venue issue):

1. Open the case detail modal
2. Click **Reschedule Case**
3. Enter a mandatory reason
4. Confirm

**What happens:**
- All juror applications (approved, pending, rejected) are **permanently deleted**
- Case is reset to the job board so new jurors can apply
- The attorney and all affected jurors receive notification emails
- A new trial date must be set by the attorney

> ⚠️ This action deletes all juror applications and cannot be undone. Use it only when necessary.

---

### Deleting a Case

1. Open the case detail modal (or find the case in the Cases table)
2. Click **Delete Case**
3. Confirm

**What happens:**
- Case is deactivated
- Attorney and all applied jurors are notified
- Case moves to the **Deleted Cases** archive

---

## 6. Reschedule Requests

When an attorney wants to change their trial date they submit a **Reschedule Request**. These appear in a dedicated section near the top of your dashboard.

### What You See Per Request

| Field | Description |
|---|---|
| Case title | Name of the case |
| Attorney | Name, email, law firm |
| Current scheduled date/time | Shown in red strikethrough |
| Requested new date/time | Shown in green |
| Reason | Attorney's stated reason |
| Comments | Any additional notes from the attorney |
| Approved jurors | Count — important because all will be deleted if approved |

---

### Approving a Reschedule Request

1. Click **Approve**
2. Optionally add a comment
3. Confirm

**What happens:**
- Trial date is updated to the attorney's requested date/time
- **All juror applications are deleted** (approved, pending, and rejected)
- Case returns to the job board so new jurors can apply for the new date
- Attorney receives: *"Your reschedule request has been approved. New trial date: [date]. All juror applications have been reset."*
- Every juror who had applied receives: *"The case you applied to has been rescheduled. Your application has been removed. You may reapply if you are available for the new date."*

> ⚠️ **This action cannot be undone.** Approved jurors lose their place and must reapply. Only approve if you are certain.

---

### Rejecting a Reschedule Request

1. Click **Reject**
2. Enter a reason (required)
3. Confirm

**What happens:**
- Original trial date and time are kept unchanged
- All juror applications remain intact
- Attorney receives: *"Your reschedule request has been rejected. Reason: [your comments]."*

---

## 7. Calendar & Schedule Management

The calendar lets you see what is booked on any day and block time slots so attorneys cannot schedule trials during those periods.

### Viewing Cases by Date

1. Find the **Calendar** section on the dashboard
2. Click any date on the calendar

The right panel shows all approved cases scheduled for that date:
- Case title and type
- Attorney name, email, phone
- Scheduled time
- Witness count, juror application count
- Click **View Details** to open the full case modal

### Blocking Dates and Times

Use blocking to prevent attorneys from scheduling trials during maintenance windows, holidays, or periods you know are unavailable.

1. Select the date you want to block on the calendar
2. Click **Block Time Slots**
3. Enter a reason (e.g., "Court closure", "Platform maintenance")
4. Choose what to block:

| Option | What it does |
|---|---|
| **Block Entire Day** | Blocks all remaining time slots for that day |
| **Select Specific Times** | Choose individual 30-minute slots (e.g., 09:00–09:30, 14:00–14:30) |

5. Click **Block**

**What happens:**
- Blocked slots are removed from the attorney scheduling calendar
- Attorneys see these slots as unavailable (shown in red with ✕)
- Existing approved cases on those slots are not affected — only future bookings are blocked

---

### Unblocking Dates and Times

1. Select the date on the calendar
2. Find the blocked slot group you want to remove
3. Click **Unblock**
4. Confirm

**What happens:**
- The selected slots become available again for attorney scheduling

---

### How Attorneys See Blocked Slots

On the attorney's scheduling calendar:
- **Red with ✕** — Fully blocked by admin, cannot be selected
- **Orange with warning** — Partially blocked (some slots on this day are unavailable)
- **Normal** — Available

---

## 8. Monitoring Live Trials

### Seeing Which Trials Are Ready

The **Ready Trials** section on your dashboard shows trials that are scheduled for today where the attorney has indicated they are ready to begin.

Each entry shows:
- Case title and attorney
- Number of approved jurors
- Number of witnesses
- Number of jury charge questions

Click **Join Trial** to enter the virtual courtroom as an observer/moderator.

---

### Inside the Trial Monitor

The trial monitor opens in a new window and has four tabs:

---

#### Video Conference Tab (Default)

This is the live video feed of the trial.

**What you see:**
- A large featured video of the selected participant
- A thumbnail strip of all participants showing who is muted (red icon)
- A participants panel on the right listing everyone in the call

**Your controls at the bottom:**

| Control | Function |
|---|---|
| Microphone button | Mute or unmute yourself |
| Camera button | Turn your video on or off |
| Start/Stop Recording | Begin or end a session recording |
| Report Incident | Document a problem during the trial |
| Leave | Exit the monitoring session |

**Managing participants:**

Click any participant in the panel to see options:

| Action | What it does |
|---|---|
| **Mute** | Silences that participant's audio |
| **Remove** | Disconnects the participant from the call (requires a reason) |

> Use **Remove** only for serious disruptions. The participant is immediately disconnected and cannot rejoin unless re-invited.

---

#### Witnesses Tab

Shows all witnesses registered for the case:
- Name, side (Plaintiff / Defendant)
- Description

You can download the witness list as a text file for reference.

---

#### Jury Charge Tab

Shows the jury instructions and tracks verdict submissions.

**Verdict Status section:**
- Total juror count vs. how many have submitted their verdict
- Progress bar and percentage
- Per-juror status: **Submitted** (with timestamp) or **Pending**

This updates automatically every 5 seconds. You can see in real time as jurors complete their verdicts.

Download options:
- Jury charge questions as a text file
- Questions as an MS Forms-compatible JSON template
- Verdict submissions as a JSON file

---

#### Incidents Tab

Documents any issues that occur during the trial.

**Incident summary cards show:**
- Total incidents reported
- Breakdown by severity: Critical, High, Disruptive, Resolved

**Each incident entry shows:**
- Type (Disruptive, Inappropriate, Technical, Connection Issue, Other)
- Severity (Critical / High / Medium / Low)
- Which participant was involved (if applicable)
- Description of what happened
- Action taken (if any)
- Who reported it and when

**To report a new incident:**
1. Click **Report Incident**
2. Select the type and severity
3. Describe what happened (required)
4. Note any action taken (optional)
5. Submit

Incidents refresh automatically every 5 seconds.

---

### Recording a Trial

1. Click **Start Recording** in the video conference controls
2. Confirm in the dialog
3. A **REC** badge with a running timer appears in the header

To stop:
1. Click **Stop Recording**
2. Confirm

The recording is saved automatically and can be accessed later from the case records.

> ⚠️ Inform all participants before starting a recording. Recording without consent may have legal implications.

---

### Leaving the Monitor

Click **Leave** at any bottom right of the controls. Confirm in the dialog. You exit the monitor but the trial continues running for the participants.

---

## 9. Notifications

### Accessing Notifications

Click the **bell icon** in the dashboard header. The badge shows how many are unread.

For the full notifications page scroll to the Notifications section or go directly to `/admin/notifications`.

---

### What Generates a Notification

| Event | Notification Type |
|---|---|
| New case submitted | Case submitted |
| Trial starting soon | Trial starting / Trial started |
| Juror applied to a case | Application received |
| Juror approved for a case | Application approved |
| War room opened by attorney | War room ready |
| Case rescheduled | Case rescheduled |
| Reschedule request approved/rejected | Reschedule status |
| Attorney deleted their own account | Attorney account deleted |

---

### Managing Notifications

**Mark as read:** Click the checkmark icon on any notification card.

**Mark all as read:** Click the **Mark all as read** button at the top of the list.

**Delete a notification:** Click the trash icon on the notification card.

**Delete multiple:** Check the boxes on several notifications, then click **Delete (X)**.

**Filter:** Use the **All / Unread / Read** buttons to filter the list.

Notifications are shown 50 per page. Use the page numbers at the bottom to navigate older notifications.

---

## 10. Deleted Records

All deletions are soft deletes — the data is kept permanently for your records but the account/case is deactivated.

---

### Deleted Cases

Scroll to the **Deleted Cases** section at the bottom of the dashboard.

**Shows:**
- Case title and type
- County and state
- Attorney name and email
- Law firm
- Approval status at time of deletion
- Number of jurors who had applied
- Date and time deleted

**Search:** Filter by case title, attorney name, email, law firm, county, or state.

**Pagination:** 10 / 25 / 50 per page.

This section only appears if at least one case has been deleted.

---

### Deleted Attorneys

Scroll past Deleted Cases to the **Deleted Attorneys** section.

**Shows:**
| Column | Details |
|---|---|
| Attorney | Full name, email address, phone number |
| Law Firm | Law firm or entity name |
| State Bar # | Their bar number |
| State | State of practice |
| Deleted By | **Admin** (you deleted them) or **Self** (they deleted their own account) |
| Deleted At | Date and time of deletion |
| Joined | Date their account was originally created |

**"Deleted By" badge colors:**
- 🔴 **Admin** — An administrator deleted this account
- 🟠 **Self** — The attorney deleted their own account from their profile

**Search:** Filter by name, email, law firm, or state.

**Pagination:** 10 / 25 / 50 per page.

> There is no restore function. These records are kept for audit and reference purposes only.

---

## 11. Common Questions

**Q: An attorney says they are verified but can't submit cases — what do I check?**
A: Go to their record in the Attorneys table and confirm their status is **Verified** (not Pending or Declined). If their status shows Verified and they still can't submit, check if there is a system notification or contact technical support.

**Q: How do I know which time slots are already booked before approving a case?**
A: Click the date on the calendar to see all approved cases for that day with their times. You can also just click Approve — the system automatically checks for conflicts and will show a conflict dialog if needed.

**Q: A juror applied but their voir dire answers disqualify them. Can I remove them?**
A: Open the case detail modal, go to the Juror Applications section, and click **Remove** next to that juror. The attorney also has the ability to reject juror applications from their War Room.

**Q: An attorney submitted a case for a date that is too soon. What is the right rejection reason?**
A: Select **Insufficient lead time** and add a comment explaining how much advance notice is required.

**Q: Can I approve a case and change the trial date at the same time?**
A: No — approving a case confirms the attorney's requested date. If the date is wrong, reject the case with comments asking them to resubmit with a new date, or use the conflict flow to suggest alternate slots.

**Q: I need to block a date that is 3 months from now. Can I do that?**
A: Yes. Navigate to that month on the calendar, select the date, and block it. Blocked dates remain until you unblock them.

**Q: A trial is live but something went wrong — how do I stop it?**
A: Join the trial via the Ready Trials section or from the case detail modal. Once inside you can mute or remove disruptive participants. If the trial needs to be cancelled entirely, contact technical support as there is no one-click "end trial" for the admin.

**Q: What is the difference between declining a juror and deleting their account?**
A: **Declining** prevents them from applying to cases but keeps their account active — you can verify them later. **Deleting** permanently deactivates the account and they cannot log in again.

**Q: A reschedule request was approved but the attorney says their jurors are gone — is that expected?**
A: Yes, this is by design. Approving a reschedule deletes all juror applications so the case can attract jurors available for the new date. The attorney should have been informed of this before submitting the request.

**Q: How do I see a history of everything I (or another admin) have done?**
A: All admin actions are logged automatically with a timestamp and IP address. Contact your system administrator or a developer to query the audit log for specific actions.

**Q: Can there be multiple admin accounts?**
A: Yes. Admin accounts are created by your system administrator. Each admin's actions are logged separately under their account.

---

*For technical issues or questions not covered here, contact the Quick Verdicts development team.*
