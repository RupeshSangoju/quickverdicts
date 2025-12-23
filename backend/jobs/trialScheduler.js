// =============================================
// trialScheduler.js - Auto-transition cases to trial
// Checks every minute for cases that need to transition from awaiting_trial to join_trial
// =============================================

const { poolPromise, sql } = require("../config/db");
const Notification = require("../models/Notification");
const { sendNotificationEmail } = require("../utils/email");

// ============================================
// SCHEDULER CONFIGURATION
// ============================================

const SCHEDULER_INTERVAL = 60 * 1000; // Run every 60 seconds
const WAR_ROOM_ACCESS_MINUTES = 30; // Open war room 30 minutes before trial
const NOTIFICATION_MINUTES = 30; // Send notifications 30 minutes before trial

// ============================================
// TIMEZONE OFFSET SQL - CALCULATED PER ATTORNEY STATE
// ============================================
// Returns timezone offset in minutes based on attorney's state
// Uses SQL CASE statement for dynamic timezone calculation
const TIMEZONE_OFFSET_SQL = `
  CASE
    -- Eastern Time (UTC-5) = -300 minutes
    WHEN a.State IN ('Connecticut', 'Delaware', 'Florida', 'Georgia', 'Maine', 'Maryland',
                     'Massachusetts', 'Michigan', 'New Hampshire', 'New Jersey', 'New York',
                     'North Carolina', 'Ohio', 'Pennsylvania', 'Rhode Island', 'South Carolina',
                     'Vermont', 'Virginia', 'West Virginia') THEN -300

    -- Central Time (UTC-6) = -360 minutes
    WHEN a.State IN ('Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Kansas', 'Kentucky',
                     'Louisiana', 'Minnesota', 'Mississippi', 'Missouri', 'Nebraska',
                     'North Dakota', 'Oklahoma', 'South Dakota', 'Tennessee', 'Texas',
                     'Wisconsin') THEN -360

    -- Mountain Time (UTC-7) = -420 minutes
    WHEN a.State IN ('Arizona', 'Colorado', 'Idaho', 'Montana', 'New Mexico', 'Utah',
                     'Wyoming') THEN -420

    -- Pacific Time (UTC-8) = -480 minutes
    WHEN a.State IN ('California', 'Nevada', 'Oregon', 'Washington') THEN -480

    -- Alaska Time (UTC-9) = -540 minutes
    WHEN a.State = 'Alaska' THEN -540

    -- Hawaii Time (UTC-10) = -600 minutes
    WHEN a.State = 'Hawaii' THEN -600

    -- India Standard Time (UTC+5:30) = +330 minutes
    WHEN a.State = 'India' THEN 330

    -- Default to UTC if state not recognized
    ELSE 0
  END
`;

let schedulerInterval = null;
let isRunning = false;

// ============================================
// TRIAL TRANSITION LOGIC
// ============================================

/**
 * Check and perform scheduled actions (war room access + notifications)
 */
async function checkAndTransitionTrials() {
  // Prevent concurrent runs
  if (isRunning) {
    console.log("⏭️  Scheduler already running, skipping this cycle");
    return;
  }

  isRunning = true;

  try {
    const pool = await poolPromise;

    // ============================================
    // STEP 1: Open War Room (1 hour before trial)
    // ============================================

    // Find cases that need war room access (1 hour before)
    const casesForWarRoomAccess = await pool.request().query(`
      SELECT
        c.CaseId,
        c.CaseTitle,
        c.ScheduledDate,
        c.ScheduledTime,
        c.AttorneyId,
        c.County,
        c.CaseType,
        a.FirstName,
        a.LastName,
        a.Email as AttorneyEmail,
        a.LawFirmName,
        a.State as AttorneyState
      FROM Cases c
      INNER JOIN Attorneys a ON c.AttorneyId = a.AttorneyId
      WHERE c.AttorneyStatus = 'awaiting_trial'
        AND c.AdminApprovalStatus = 'approved'
        AND DATEDIFF(MINUTE, DATEADD(MINUTE, ${TIMEZONE_OFFSET_SQL}, GETDATE()),
            CAST(CONCAT(
              CONVERT(VARCHAR(10), c.ScheduledDate, 120),
              ' ',
              CONVERT(VARCHAR(8), c.ScheduledTime, 108)
            ) AS DATETIME)
          ) <= ${WAR_ROOM_ACCESS_MINUTES}
        AND DATEDIFF(MINUTE, DATEADD(MINUTE, ${TIMEZONE_OFFSET_SQL}, GETDATE()),
            CAST(CONCAT(
              CONVERT(VARCHAR(10), c.ScheduledDate, 120),
              ' ',
              CONVERT(VARCHAR(8), c.ScheduledTime, 108)
            ) AS DATETIME)
          ) >= 0  -- Don't open war room for trials that have already started
    `);

    if (casesForWarRoomAccess.recordset.length > 0) {
      console.log(`🚪 Found ${casesForWarRoomAccess.recordset.length} case(s) ready for war room access`);

      for (const caseData of casesForWarRoomAccess.recordset) {
        try {
          await openWarRoomAccess(caseData, pool);
        } catch (error) {
          console.error(`❌ Error opening war room for case ${caseData.CaseId}:`, error);
        }
      }
    }

    // ============================================
    // STEP 2: Send Notifications (15 minutes before trial)
    // ============================================

    // Find cases that need notifications sent (15 minutes before)
    const casesForNotifications = await pool.request().query(`
      SELECT
        c.CaseId,
        c.CaseTitle,
        c.ScheduledDate,
        c.ScheduledTime,
        c.AttorneyId,
        c.County,
        c.CaseType,
        c.NotificationsSent,
        a.FirstName,
        a.LastName,
        a.Email as AttorneyEmail,
        a.LawFirmName,
        a.State as AttorneyState
      FROM Cases c
      INNER JOIN Attorneys a ON c.AttorneyId = a.AttorneyId
      WHERE c.AttorneyStatus = 'join_trial'
        AND c.AdminApprovalStatus = 'approved'
        AND (c.NotificationsSent IS NULL OR c.NotificationsSent = 0)
        AND DATEDIFF(MINUTE, DATEADD(MINUTE, ${TIMEZONE_OFFSET_SQL}, GETDATE()),
            CAST(CONCAT(
              CONVERT(VARCHAR(10), c.ScheduledDate, 120),
              ' ',
              CONVERT(VARCHAR(8), c.ScheduledTime, 108)
            ) AS DATETIME)
          ) <= ${NOTIFICATION_MINUTES}
        AND DATEDIFF(MINUTE, DATEADD(MINUTE, ${TIMEZONE_OFFSET_SQL}, GETDATE()),
            CAST(CONCAT(
              CONVERT(VARCHAR(10), c.ScheduledDate, 120),
              ' ',
              CONVERT(VARCHAR(8), c.ScheduledTime, 108)
            ) AS DATETIME)
          ) >= -60  -- Don't notify for trials that started over 1 hour ago
    `);

    if (casesForNotifications.recordset.length > 0) {
      console.log(`🔔 Found ${casesForNotifications.recordset.length} case(s) ready for notifications`);

      for (const caseData of casesForNotifications.recordset) {
        try {
          await sendTrialNotifications(caseData, pool);
        } catch (error) {
          console.error(`❌ Error sending notifications for case ${caseData.CaseId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("❌ Trial scheduler error:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Open war room access (1 hour before trial)
 * Just changes status to 'join_trial' without sending notifications
 */
async function openWarRoomAccess(caseData, pool) {
  const caseId = caseData.CaseId;

  console.log(`🚪 Opening war room access for case ${caseId}: "${caseData.CaseTitle}"`);

  // ✅ Update case status to join_trial (makes war room accessible)
  await pool.request().input("caseId", sql.Int, caseId).query(`
    UPDATE Cases
    SET AttorneyStatus = 'join_trial', UpdatedAt = GETUTCDATE()
    WHERE CaseId = @caseId
  `);

  console.log(`✅ War room is now accessible for case ${caseId} (1 hour before trial)`);
}

/**
 * Send trial notifications (15 minutes before trial)
 * Sends emails and notifications to jurors, attorney, and admins
 */
async function sendTrialNotifications(caseData, pool) {
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

  console.log(`🔔 Sending notifications for case ${caseId}: "${caseData.CaseTitle}"`);


  // ✅ Get all approved jurors
  const jurors = await pool.request().input("caseId", sql.Int, caseId).query(`
    SELECT j.JurorId, j.Email, j.Name
    FROM JurorApplications ja
    INNER JOIN Jurors j ON ja.JurorId = j.JurorId
    WHERE ja.CaseId = @caseId AND ja.Status = 'approved'
  `);

  // ✅ Get all admins
  const admins = await pool.request().query(`
    SELECT AdminId, Email,
           COALESCE(FirstName + ' ' + LastName, Username, 'Admin') as Name
    FROM Admins
    WHERE IsActive = 1
  `);

  // ✅ Send notifications and emails to jurors
  for (const juror of jurors.recordset) {
    try {
      // Create notification
      await Notification.createNotification({
        userId: juror.JurorId,
        userType: 'juror',
        caseId: caseId,
        type: Notification.NOTIFICATION_TYPES.TRIAL_STARTING,
        title: 'Trial Starting Soon - Join Now!',
        message: `The trial for "${caseData.CaseTitle}" is starting in ${NOTIFICATION_MINUTES} minutes! Please join the trial room now.`
      });

      // Send email
      const emailContent = `
        <h2 style="color: #16305B; margin-top: 0;">🎥 Trial Starting Soon!</h2>
        <p style="color: #666; line-height: 1.6;">Dear ${juror.Name},</p>
        <p style="color: #666; line-height: 1.6;">
          The trial for <strong>"${caseData.CaseTitle}"</strong> is starting in <strong>${NOTIFICATION_MINUTES} minutes</strong>!
        </p>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <p style="color: #92400e; margin: 0; font-size: 18px;">
            <strong>⏰ Action Required:</strong> Join the trial NOW
          </p>
          <p style="color: #92400e; margin: 10px 0 0 0; font-size: 16px;">
            Trial Date: ${trialDate}
          </p>
          <p style="color: #92400e; margin: 5px 0 0 0; font-size: 16px;">
            Trial Time: ${trialTime}
          </p>
        </div>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${process.env.FRONTEND_URL}/juror" style="display: inline-block; background: #16305B; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
            Join Trial Now
          </a>
        </div>
        <p style="color: #666; line-height: 1.6;">
          Please ensure your camera and microphone are working properly before joining.
        </p>
        <p style="color: #666; line-height: 1.6;">
          Best regards,<br/>
          Quick Verdicts Team
        </p>
      `;

      await sendNotificationEmail(
        juror.Email,
        `⏰ Trial Starting in ${NOTIFICATION_MINUTES} Minutes - Join Now!`,
        emailContent
      );

      console.log(`  ✅ Notified juror ${juror.JurorId} (${juror.Email})`);
    } catch (error) {
      console.error(`  ❌ Failed to notify juror ${juror.JurorId}:`, error);
    }
  }

  // ✅ Send notification and email to attorney
  try {
    await Notification.createNotification({
      userId: caseData.AttorneyId,
      userType: 'attorney',
      caseId: caseId,
      type: Notification.NOTIFICATION_TYPES.TRIAL_STARTING,
      title: 'Trial Room Ready - Start Trial',
      message: `Your trial for "${caseData.CaseTitle}" is ready to start! All jurors have been notified.`
    });

    const attorneyEmailContent = `
      <h2 style="color: #16305B; margin-top: 0;">🎥 Trial Room Ready</h2>
      <p style="color: #666; line-height: 1.6;">Dear ${attorneyName},</p>
      <p style="color: #666; line-height: 1.6;">
        The trial room for <strong>"${caseData.CaseTitle}"</strong> is now active and ready to begin!
      </p>
      <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin: 25px 0; border-radius: 4px;">
        <p style="color: #16a34a; margin: 0; font-size: 16px;">
          <strong>✓ Trial Status:</strong> Ready to Start
        </p>
        <p style="color: #16a34a; margin: 10px 0 0 0; font-size: 16px;">
          <strong>📅 Trial Date:</strong> ${trialDate}
        </p>
        <p style="color: #16a34a; margin: 5px 0 0 0; font-size: 16px;">
          <strong>🕐 Trial Time:</strong> ${trialTime}
        </p>
        <p style="color: #16a34a; margin: 5px 0 0 0; font-size: 16px;">
          <strong>👥 Jurors:</strong> All ${jurors.recordset.length} approved jurors notified
        </p>
      </div>
      <div style="text-align: center; margin: 35px 0;">
        <a href="${process.env.FRONTEND_URL}/attorney" style="display: inline-block; background: #16305B; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
          Start Trial
        </a>
      </div>
      <p style="color: #666; line-height: 1.6;">
        You can start the trial when you're ready. All participants have been notified and can join.
      </p>
      <p style="color: #666; line-height: 1.6;">
        Best regards,<br/>
        Quick Verdicts Team
      </p>
    `;

    await sendNotificationEmail(
      caseData.AttorneyEmail,
      'Trial Room Ready - You Can Start Now',
      attorneyEmailContent
    );

    console.log(`  ✅ Notified attorney ${caseData.AttorneyId} (${caseData.AttorneyEmail})`);
  } catch (error) {
    console.error(`  ❌ Failed to notify attorney:`, error);
  }

  // ✅ Send notification and email to admins
  for (const admin of admins.recordset) {
    try {
      await Notification.createNotification({
        userId: admin.AdminId,
        userType: 'admin',
        caseId: caseId,
        type: Notification.NOTIFICATION_TYPES.TRIAL_STARTED,
        title: 'Trial Started - Case Now Live',
        message: `Trial "${caseData.CaseTitle}" has transitioned to join_trial status. Attorney ${attorneyName} and all jurors have been notified.`
      });

      const adminEmailContent = `
        <h2 style="color: #16305B; margin-top: 0;">Trial Started</h2>
        <p style="color: #666; line-height: 1.6;">Hello Admin,</p>
        <p style="color: #666; line-height: 1.6;">
          The trial for <strong>"${caseData.CaseTitle}"</strong> has automatically transitioned to live status.
        </p>
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <p style="color: #1e40af; margin: 0; font-size: 16px;">
            <strong>📋 Trial Details:</strong>
          </p>
          <p style="color: #1e40af; margin: 10px 0 0 0; font-size: 14px;">
            Case ID: ${caseId}
          </p>
          <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 14px;">
            Attorney: ${attorneyName}
          </p>
          <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 14px;">
            Type: ${caseData.CaseType} | County: ${caseData.County}
          </p>
          <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 14px;">
            Scheduled: ${trialDate} at ${trialTime}
          </p>
          <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 14px;">
            Jurors Notified: ${jurors.recordset.length}
          </p>
        </div>
        <p style="color: #666; line-height: 1.6;">
          All participants have been notified and can join the trial room.
        </p>
        <p style="color: #666; line-height: 1.6;">
          Best regards,<br/>
          Quick Verdicts System
        </p>
      `;

      await sendNotificationEmail(
        admin.Email,
        `Trial Started - ${caseData.CaseTitle}`,
        adminEmailContent
      );

      console.log(`  ✅ Notified admin ${admin.AdminId} (${admin.Email})`);
    } catch (error) {
      console.error(`  ❌ Failed to notify admin ${admin.AdminId}:`, error);
    }
  }

  // ✅ Mark notifications as sent to prevent duplicate notifications
  await pool.request().input("caseId", sql.Int, caseId).query(`
    UPDATE Cases
    SET NotificationsSent = 1, UpdatedAt = GETUTCDATE()
    WHERE CaseId = @caseId
  `);

  console.log(`✅ Successfully sent notifications for case ${caseId} (${NOTIFICATION_MINUTES} minutes before trial)`);
}

// ============================================
// SCHEDULER CONTROL FUNCTIONS
// ============================================

/**
 * Start the trial scheduler
 */
function startScheduler() {
  if (schedulerInterval) {
    console.log("⚠️  Trial scheduler already running");
    return;
  }

  console.log("🕐 Starting trial scheduler...");
  console.log(`   ⏱️  Checking every ${SCHEDULER_INTERVAL / 1000} seconds`);
  console.log(`   🚪 War room opens ${WAR_ROOM_ACCESS_MINUTES} minutes before trial`);
  console.log(`   🔔 Notifications sent ${NOTIFICATION_MINUTES} minutes before trial`);

  // Run immediately on start
  checkAndTransitionTrials();

  // Then run on interval
  schedulerInterval = setInterval(checkAndTransitionTrials, SCHEDULER_INTERVAL);

  console.log("✅ Trial scheduler started successfully");
}

/**
 * Stop the trial scheduler
 */
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("🛑 Trial scheduler stopped");
  }
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    running: schedulerInterval !== null,
    isProcessing: isRunning,
    interval: SCHEDULER_INTERVAL,
    warRoomAccessMinutes: WAR_ROOM_ACCESS_MINUTES,
    notificationMinutes: NOTIFICATION_MINUTES,
  };
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on("SIGTERM", stopScheduler);
process.on("SIGINT", stopScheduler);

// ============================================
// EXPORTS
// ============================================

module.exports = {
  startScheduler,
  stopScheduler,
  checkAndTransitionTrials,
  getSchedulerStatus,
};
