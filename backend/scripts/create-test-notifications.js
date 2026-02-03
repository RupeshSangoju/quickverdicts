// =============================================
// Script to create 71 test notifications for pagination testing
// =============================================

const {
  createBulkNotifications,
  NOTIFICATION_TYPES,
  USER_TYPES,
} = require("../models/Notification");

const notificationMessages = [
  {
    type: NOTIFICATION_TYPES.CASE_SUBMITTED,
    title: "New Case Submitted",
    message: "Your case has been successfully submitted for review.",
  },
  {
    type: NOTIFICATION_TYPES.APPLICATION_RECEIVED,
    title: "Application Received",
    message: "We have received your jury application and will review it shortly.",
  },
  {
    type: NOTIFICATION_TYPES.WAR_ROOM_READY,
    title: "War Room Ready",
    message: "Your trial war room is now ready. You can access it from your dashboard.",
  },
  {
    type: NOTIFICATION_TYPES.VERDICT_NEEDED,
    title: "Verdict Required",
    message: "Please submit your verdict for the ongoing case.",
  },
  {
    type: NOTIFICATION_TYPES.CASE_APPROVED,
    title: "Case Approved",
    message: "Great news! Your case has been approved and scheduled.",
  },
  {
    type: NOTIFICATION_TYPES.TRIAL_STARTING,
    title: "Trial Starting Soon",
    message: "Your trial will begin in 30 minutes. Please be ready.",
  },
  {
    type: NOTIFICATION_TYPES.PAYMENT_PROCESSED,
    title: "Payment Processed",
    message: "Your payment has been successfully processed.",
  },
  {
    type: NOTIFICATION_TYPES.VERDICT_SUBMITTED,
    title: "Verdict Submitted",
    message: "Thank you for submitting your verdict.",
  },
  {
    type: NOTIFICATION_TYPES.CASE_COMPLETED,
    title: "Case Completed",
    message: "Your case has been completed successfully.",
  },
  {
    type: NOTIFICATION_TYPES.ACCOUNT_VERIFIED,
    title: "Account Verified",
    message: "Your account has been verified and is now active.",
  },
];

async function createTestNotifications() {
  try {
    console.log("Creating 71 test notifications...");

    // You can change these values based on your test user
    const userId = 1; // Change this to your test user ID
    const userType = USER_TYPES.ATTORNEY; // Change to JUROR or ADMIN as needed

    // Create array of 71 notifications
    const notifications = [];
    for (let i = 1; i <= 71; i++) {
      // Cycle through different notification types
      const template =
        notificationMessages[(i - 1) % notificationMessages.length];

      notifications.push({
        userId: userId,
        userType: userType,
        caseId: i <= 50 ? i : null, // First 50 have case IDs
        type: template.type,
        title: `${template.title} #${i}`,
        message: `${template.message} (Test notification ${i})`,
      });
    }

    // Create notifications in bulk
    const created = await createBulkNotifications(notifications);

    console.log(`✓ Successfully created ${created} notifications`);
    console.log(`  User ID: ${userId}`);
    console.log(`  User Type: ${userType}`);
    console.log(`  Distribution:`);
    console.log(`    - Page 1: 50 notifications`);
    console.log(`    - Page 2: 21 notifications`);

    process.exit(0);
  } catch (error) {
    console.error("Error creating test notifications:", error);
    process.exit(1);
  }
}

// Run the script
createTestNotifications();
