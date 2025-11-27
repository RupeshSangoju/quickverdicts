// Load environment variables FIRST
require("dotenv").config();

const bcrypt = require("bcryptjs");
const { poolPromise, sql } = require("../config/db");

async function createAdmin() {
  try {
    const email = "admin@virtualjury.com";
    const password = "Admin@123"; // CHANGE THIS AFTER FIRST LOGIN!
    const username = "systemadmin";
    const firstName = "System";
    const lastName = "Admin";
    const phoneNumber = "+1234567890";

    console.log("🔐 Creating admin account...");

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const pool = await poolPromise;

    // Check if admin exists
    const existing = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT AdminId FROM dbo.Admins WHERE Email = @email");

    if (existing.recordset.length > 0) {
      console.log("❌ Admin already exists with this email");
      console.log("✅ You can use existing credentials to login");
      process.exit(1);
    }

    // Create admin
    const result = await pool
      .request()
      .input("username", sql.NVarChar, username)
      .input("firstName", sql.NVarChar, firstName)
      .input("lastName", sql.NVarChar, lastName)
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, hashedPassword)
      .input("phoneNumber", sql.NVarChar, phoneNumber).query(`
        INSERT INTO dbo.Admins (
          Username, 
          FirstName, 
          LastName, 
          Email, 
          Password, 
          PhoneNumber, 
          IsActive
        )
        OUTPUT INSERTED.AdminId
        VALUES (
          @username, 
          @firstName, 
          @lastName, 
          @email, 
          @password, 
          @phoneNumber, 
          1
        )
      `);

    console.log("✅ Admin created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`👤 Username: ${username}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🆔 Admin ID: ${result.recordset[0].AdminId}`);
    console.log(`📱 Phone: ${phoneNumber}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️  SECURITY WARNING:");
    console.log("   1. Change password immediately after first login");
    console.log("   2. Never share these credentials");
    console.log("   3. Enable 2FA if available");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
}

createAdmin();
