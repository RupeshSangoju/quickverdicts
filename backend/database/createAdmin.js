// =============================================
// Create Admin Script
// Creates a new admin user in the database
// =============================================

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { poolPromise, sql } = require('../config/db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function questionHidden(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const originalStdinMode = stdin.setRawMode ? stdin.isRaw : false;

    process.stdout.write(prompt);

    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }

    let password = '';

    stdin.once('data', function onData(char) {
      char = char.toString();

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(originalStdinMode);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        default:
          password += char;
          process.stdout.write('*');
          stdin.once('data', onData);
          break;
      }
    });
  });
}

async function createAdmin() {
  console.log('\n' + '='.repeat(60));
  console.log('👤 CREATE NEW ADMIN');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Get admin details
    const username = await question('Username: ');
    const email = await question('Email: ');
    const password = await question('Password: ');
    const firstName = await question('First Name (optional): ');
    const lastName = await question('Last Name (optional): ');
    const phoneNumber = await question('Phone Number (optional): ');

    // Validate inputs
    if (!username || username.trim().length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Valid email is required');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    console.log('\n🔄 Connecting to database...');
    const pool = await poolPromise;
    console.log('✅ Connected\n');

    // Check if admin with this email already exists
    console.log('🔍 Checking for existing admin...');
    const checkResult = await pool
      .request()
      .input('email', sql.NVarChar, email.toLowerCase().trim())
      .query('SELECT AdminId FROM dbo.Admins WHERE LOWER(Email) = @email');

    if (checkResult.recordset.length > 0) {
      throw new Error('Admin with this email already exists');
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin
    console.log('👤 Creating admin...');
    const result = await pool
      .request()
      .input('username', sql.NVarChar, username.trim())
      .input('email', sql.NVarChar, email.toLowerCase().trim())
      .input('passwordHash', sql.NVarChar, passwordHash)
      .input('firstName', sql.NVarChar, firstName?.trim() || null)
      .input('lastName', sql.NVarChar, lastName?.trim() || null)
      .input('phoneNumber', sql.NVarChar, phoneNumber?.trim() || null)
      .input('role', sql.NVarChar, 'admin')
      .input('isActive', sql.Bit, true)
      .query(`
        INSERT INTO dbo.Admins (
          Username, Email, PasswordHash, FirstName, LastName,
          PhoneNumber, Role, IsActive, IsDeleted,
          CreatedAt, UpdatedAt
        )
        VALUES (
          @username, @email, @passwordHash, @firstName, @lastName,
          @phoneNumber, @role, @isActive, 0,
          GETUTCDATE(), GETUTCDATE()
        );
        SELECT SCOPE_IDENTITY() AS AdminId;
      `);

    const adminId = result.recordset[0].AdminId;

    console.log('\n' + '='.repeat(60));
    console.log('✅ ADMIN CREATED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`\nAdmin ID: ${adminId}`);
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    console.log(`Name: ${firstName} ${lastName}`);
    console.log('\n🎉 You can now login with these credentials!\n');

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ FAILED TO CREATE ADMIN');
    console.error('='.repeat(60));
    console.error('\nError:', error.message);

    rl.close();
    process.exit(1);
  }
}

// Run the script
createAdmin();
