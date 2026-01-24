// =============================================
// trialReminderScheduler.js - Send countdown reminder emails
// Sends daily reminder emails 4, 3, 2, 1 days before trial
// =============================================

const { poolPromise, sql } = require("../config/db");
const { sendNotificationEmail } = require("../utils/email");

// ============================================
// SCHEDULER CONFIGURATION
// ============================================

const REMINDER_DAYS = [4, 3, 2, 1]; // Send reminders 4, 3, 2, 1 days before trial
const SCHEDULER_INTERVAL = 24 * 60 * 60 * 1000; // Run once per day (24 hours)
const CHECK_TIME_HOUR = 9; // Check at 9 AM daily

let schedulerInterval = null;
let isRunning = false;

// ============================================
// REMINDER EMAIL LOGIC
// ============================================

/**
 * Check and send reminder emails for upcoming trials
 */
async function checkAndSendReminders() {
  // Prevent concurrent runs
  if (isRunning) {
    console.log("⏭️  Reminder scheduler already running, skipping this cycle");
    return;
  }

  isRunning = true;

  try {
    const pool = await poolPromise;

    console.log("📧 [Trial Reminders] Starting daily reminder check...");

    // For each reminder day (4, 3, 2, 1 days before)
    for (const daysBeforeTrial of REMINDER_DAYS) {
      await sendRemindersForDay(pool, daysBeforeTrial);
    }

    console.log("✅ [Trial Reminders] Daily reminder check completed");
  } catch (error) {
    console.error("❌ Trial reminder scheduler error:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Send reminders for cases happening in X days
 */
async function sendRemindersForDay(pool, daysBeforeTrial) {
  try {
    // Find cases scheduled for X days from now
    // We need to account for timezone offsets stored in the Cases table
    const casesQuery = await pool.request()
      .input("daysBeforeTrial", sql.Int, daysBeforeTrial)
      .query(`
        SELECT
          c.CaseId,
          c.CaseTitle,
          c.CaseType,
          c.County,
          c.ScheduledDate,
          c.ScheduledTime,
          c.TimezoneOffset,
          c.AttorneyId,
          c.Reminders4Days,
          c.Reminders3Days,
          c.Reminders2Days,
          c.Reminders1Day,
          a.FirstName,
          a.LastName,
          a.Email AS AttorneyEmail,
          a.LawFirmName,
          CAST(c.ScheduledDate AS DATE) AS TrialDateOnly
        FROM Cases c
        INNER JOIN Attorneys a ON c.AttorneyId = a.AttorneyId
        WHERE c.AdminApprovalStatus = 'approved'
          AND c.IsDeleted = 0
          AND c.AttorneyStatus IN ('war_room', 'join_trial')
          AND DATEDIFF(DAY, CAST(GETUTCDATE() AS DATE), CAST(c.ScheduledDate AS DATE)) = @daysBeforeTrial
      `);

    const cases = casesQuery.recordset;

    if (cases.length === 0) {
      console.log(`  📭 No cases found ${daysBeforeTrial} days before trial`);
      return;
    }

    console.log(`  📬 Found ${cases.length} case(s) ${daysBeforeTrial} days before trial`);

    for (const caseData of cases) {
      // Check if reminder already sent
      const reminderFieldName = `Reminders${daysBeforeTrial}Days`;
      if (caseData[reminderFieldName] === 1 || caseData[reminderFieldName] === true) {
        console.log(`    ⏭️  Reminder already sent for case ${caseData.CaseId} (${daysBeforeTrial} days)`);
        continue;
      }

      try {
        await sendReminderForCase(pool, caseData, daysBeforeTrial);

        // Mark reminder as sent
        await pool.request()
          .input("caseId", sql.Int, caseData.CaseId)
          .input("fieldName", sql.NVarChar, reminderFieldName)
          .query(`
            UPDATE Cases
            SET ${reminderFieldName} = 1, UpdatedAt = GETUTCDATE()
            WHERE CaseId = @caseId
          `);

        console.log(`    ✅ Reminder sent and marked for case ${caseData.CaseId}`);
      } catch (error) {
        console.error(`    ❌ Error sending reminder for case ${caseData.CaseId}:`, error);
      }
    }
  } catch (error) {
    console.error(`❌ Error sending reminders for ${daysBeforeTrial} days before:`, error);
  }
}

/**
 * Send reminder emails to attorney and jurors for a specific case
 */
async function sendReminderForCase(pool, caseData, daysBeforeTrial) {
  const caseId = caseData.CaseId;
  const attorneyName = `${caseData.FirstName} ${caseData.LastName}`;

  // Format trial date and time
  const trialDate = new Date(caseData.ScheduledDate).toLocaleDateString("en-US", {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const trialTime = caseData.ScheduledTime;

  console.log(`    📧 Sending ${daysBeforeTrial}-day reminder for case ${caseId}: "${caseData.CaseTitle}"`);

  // Get all approved jurors
  const jurors = await pool.request().input("caseId", sql.Int, caseId).query(`
    SELECT j.JurorId, j.Email, j.Name
    FROM JurorApplications ja
    INNER JOIN Jurors j ON ja.JurorId = j.JurorId
    WHERE ja.CaseId = @caseId AND ja.Status = 'approved'
  `);

  // Send reminder to attorney
  try {
    const attorneyEmailContent = `
      <h2 style="color: #16305B; margin-top: 0;">📅 Trial Reminder - ${daysBeforeTrial} Day${daysBeforeTrial > 1 ? 's' : ''} Until Trial</h2>
      <p style="color: #666; line-height: 1.6;">Dear ${attorneyName},</p>
      <p style="color: #666; line-height: 1.6;">
        This is a friendly reminder that your trial <strong>"${caseData.CaseTitle}"</strong> is coming up in <strong>${daysBeforeTrial} day${daysBeforeTrial > 1 ? 's' : ''}</strong>.
      </p>
      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 4px;">
        <p style="color: #1e40af; margin: 0; font-size: 18px;">
          <strong>📋 Trial Details:</strong>
        </p>
        <p style="color: #1e40af; margin: 10px 0 0 0; font-size: 16px;">
          <strong>Case:</strong> ${caseData.CaseTitle}
        </p>
        <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 16px;">
          <strong>Date:</strong> ${trialDate}
        </p>
        <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 16px;">
          <strong>Time:</strong> ${trialTime}
        </p>
        <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 16px;">
          <strong>Type:</strong> ${caseData.CaseType}
        </p>
        <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 16px;">
          <strong>County:</strong> ${caseData.County}
        </p>
        <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 16px;">
          <strong>Approved Jurors:</strong> ${jurors.recordset.length}
        </p>
      </div>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 4px;">
        <p style="color: #92400e; margin: 0; font-size: 16px;">
          <strong>⚠️ Preparation Checklist:</strong>
        </p>
        <ul style="color: #92400e; margin: 10px 0 0 20px; padding: 0;">
          <li style="margin: 5px 0;">Review all case materials and evidence</li>
          <li style="margin: 5px 0;">Ensure all witnesses are prepared</li>
          <li style="margin: 5px 0;">Test your camera and microphone</li>
          <li style="margin: 5px 0;">Check your internet connection</li>
          <li style="margin: 5px 0;">Review jury charge questions</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 35px 0;">
        <a href="${process.env.FRONTEND_URL}/attorney/cases/${caseId}/war-room" style="display: inline-block; background: #16305B; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
          View War Room
        </a>
      </div>
      <p style="color: #666; line-height: 1.6;">
        If you have any questions or need to reschedule, please contact us as soon as possible.
      </p>
      <p style="color: #666; line-height: 1.6;">
        Best regards,<br/>
        Quick Verdicts Team
      </p>
    `;

    await sendNotificationEmail(
      caseData.AttorneyEmail,
      `Trial Reminder: ${daysBeforeTrial} Day${daysBeforeTrial > 1 ? 's' : ''} Until "${caseData.CaseTitle}"`,
      attorneyEmailContent
    );

    console.log(`      ✅ Reminded attorney (${caseData.AttorneyEmail})`);
  } catch (error) {
    console.error(`      ❌ Failed to remind attorney:`, error);
  }

  // Send reminder to all approved jurors
  for (const juror of jurors.recordset) {
    try {
      const jurorEmailContent = `
        <h2 style="color: #16305B; margin-top: 0;">📅 Trial Reminder - ${daysBeforeTrial} Day${daysBeforeTrial > 1 ? 's' : ''} Until Trial</h2>
        <p style="color: #666; line-height: 1.6;">Dear ${juror.Name},</p>
        <p style="color: #666; line-height: 1.6;">
          This is a friendly reminder that the trial for <strong>"${caseData.CaseTitle}"</strong> is coming up in <strong>${daysBeforeTrial} day${daysBeforeTrial > 1 ? 's' : ''}</strong>.
        </p>
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <p style="color: #1e40af; margin: 0; font-size: 18px;">
            <strong>📋 Trial Details:</strong>
          </p>
          <p style="color: #1e40af; margin: 10px 0 0 0; font-size: 16px;">
            <strong>Case:</strong> ${caseData.CaseTitle}
          </p>
          <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 16px;">
            <strong>Date:</strong> ${trialDate}
          </p>
          <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 16px;">
            <strong>Time:</strong> ${trialTime}
          </p>
          <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 16px;">
            <strong>Type:</strong> ${caseData.CaseType}
          </p>
          <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 16px;">
            <strong>County:</strong> ${caseData.County}
          </p>
        </div>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <p style="color: #92400e; margin: 0; font-size: 16px;">
            <strong>⚠️ Important Reminders:</strong>
          </p>
          <ul style="color: #92400e; margin: 10px 0 0 20px; padding: 0;">
            <li style="margin: 5px 0;">Test your camera and microphone before the trial</li>
            <li style="margin: 5px 0;">Ensure you have a stable internet connection</li>
            <li style="margin: 5px 0;">Find a quiet location for the trial</li>
            <li style="margin: 5px 0;">Be ready to join 10 minutes early</li>
            <li style="margin: 5px 0;">Have a notepad ready to take notes</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${process.env.FRONTEND_URL}/juror" style="display: inline-block; background: #16305B; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
            Go to Dashboard
          </a>
        </div>
        <p style="color: #666; line-height: 1.6;">
          Thank you for your participation as a juror. Your service is greatly appreciated.
        </p>
        <p style="color: #666; line-height: 1.6;">
          Best regards,<br/>
          Quick Verdicts Team
        </p>
      `;

      await sendNotificationEmail(
        juror.Email,
        `Trial Reminder: ${daysBeforeTrial} Day${daysBeforeTrial > 1 ? 's' : ''} Until Trial`,
        jurorEmailContent
      );

      console.log(`      ✅ Reminded juror ${juror.JurorId} (${juror.Email})`);
    } catch (error) {
      console.error(`      ❌ Failed to remind juror ${juror.JurorId}:`, error);
    }
  }

  console.log(`    ✅ Sent ${daysBeforeTrial}-day reminder to attorney and ${jurors.recordset.length} jurors`);
}

// ============================================
// SCHEDULER CONTROL FUNCTIONS
// ============================================

/**
 * Start the reminder scheduler
 */
function startReminderScheduler() {
  if (schedulerInterval) {
    console.log("⚠️  Trial reminder scheduler already running");
    return;
  }

  console.log("🕐 Starting trial reminder scheduler...");
  console.log(`   ⏱️  Checking once per day at ${CHECK_TIME_HOUR}:00`);
  console.log(`   📧 Sending reminders at: ${REMINDER_DAYS.join(', ')} days before trial`);

  // Calculate time until next check (next 9 AM)
  const now = new Date();
  const nextRun = new Date();
  nextRun.setHours(CHECK_TIME_HOUR, 0, 0, 0);

  // If we've passed 9 AM today, schedule for tomorrow
  if (now > nextRun) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const msUntilNextRun = nextRun - now;
  console.log(`   🕐 Next check in ${Math.round(msUntilNextRun / 1000 / 60)} minutes at ${nextRun.toLocaleString()}`);

  // Schedule first run
  setTimeout(() => {
    checkAndSendReminders();
    // Then run every 24 hours
    schedulerInterval = setInterval(checkAndSendReminders, SCHEDULER_INTERVAL);
  }, msUntilNextRun);

  console.log("✅ Trial reminder scheduler started successfully");
}

/**
 * Stop the reminder scheduler
 */
function stopReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("🛑 Trial reminder scheduler stopped");
  }
}

/**
 * Get scheduler status
 */
function getReminderSchedulerStatus() {
  return {
    running: schedulerInterval !== null,
    isProcessing: isRunning,
    interval: SCHEDULER_INTERVAL,
    checkTimeHour: CHECK_TIME_HOUR,
    reminderDays: REMINDER_DAYS,
  };
}

/**
 * Manually trigger reminder check (for testing)
 */
async function manuallyTriggerReminders() {
  console.log("🔧 Manually triggering reminder check...");
  await checkAndSendReminders();
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on("SIGTERM", stopReminderScheduler);
process.on("SIGINT", stopReminderScheduler);

// ============================================
// EXPORTS
// ============================================

module.exports = {
  startReminderScheduler,
  stopReminderScheduler,
  getReminderSchedulerStatus,
  manuallyTriggerReminders,
  checkAndSendReminders,
};
