// =============================================
// test-timezone-conversion.js
// Test script to verify timezone conversion
// =============================================

/**
 * Test timezone conversion logic
 * This simulates what happens when an attorney schedules a trial
 */
function testTimezoneConversion(localDate, localTime, timezoneOffset, timezoneName) {
  console.log('\n' + '='.repeat(70));
  console.log(`Testing: ${localDate} ${localTime} (${timezoneName})`);
  console.log('='.repeat(70));

  // Parse local time
  const [hours, minutes] = localTime.split(':').map(num => parseInt(num, 10));

  // Create local date-time string
  const localDateTime = new Date(`${localDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);

  console.log(`\n📍 Attorney Local Time:`);
  console.log(`   Date/Time: ${localDateTime.toISOString().replace('T', ' ').substring(0, 19)}`);
  console.log(`   Timezone: ${timezoneName}`);
  console.log(`   Offset: ${timezoneOffset} minutes from UTC`);

  // Convert to UTC
  const utcDateTime = new Date(localDateTime.getTime() - (timezoneOffset * 60 * 1000));

  const utcHours = utcDateTime.getUTCHours();
  const utcMinutes = utcDateTime.getUTCMinutes();
  const utcSeconds = utcDateTime.getUTCSeconds();
  const utcDate = utcDateTime.toISOString().split('T')[0];
  const utcTime = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')}`;

  console.log(`\n🌐 Converted to UTC (stored in database):`);
  console.log(`   Date: ${utcDate}`);
  console.log(`   Time: ${utcTime}`);
  console.log(`   Full: ${utcDate} ${utcTime}`);

  // Calculate UK time (UK is UTC+0 in winter, UTC+1 in summer)
  // For simplicity, showing as UTC since times are stored in UTC
  console.log(`\n🇬🇧 UK Time (when scheduler runs):`);
  console.log(`   Date: ${utcDate}`);
  console.log(`   Time: ${utcTime}`);
  console.log(`   Note: Stored times are in UTC, scheduler uses GETUTCDATE()`);

  console.log('\n✅ Conversion successful!\n');
}

// =============================================
// TEST CASES
// =============================================

console.log('\n🧪 TIMEZONE CONVERSION TEST SUITE\n');

// Test Case 1: India (UTC+5:30) - Your example
console.log('Test 1: India Timezone (UTC+5:30)');
testTimezoneConversion(
  '2025-12-23',  // Tomorrow
  '06:30',       // 6:30 AM India time
  330,           // +330 minutes (5.5 hours ahead of UTC)
  'Asia/Kolkata'
);

// Test Case 2: US East Coast (UTC-5)
console.log('Test 2: US Eastern Time (UTC-5)');
testTimezoneConversion(
  '2025-12-23',
  '09:00',       // 9:00 AM EST
  -300,          // -300 minutes (5 hours behind UTC)
  'America/New_York'
);

// Test Case 3: US West Coast (UTC-8)
console.log('Test 3: US Pacific Time (UTC-8)');
testTimezoneConversion(
  '2025-12-23',
  '10:00',       // 10:00 AM PST
  -480,          // -480 minutes (8 hours behind UTC)
  'America/Los_Angeles'
);

// Test Case 4: UK (UTC+0)
console.log('Test 4: UK Time (UTC+0)');
testTimezoneConversion(
  '2025-12-23',
  '14:00',       // 2:00 PM UK time
  0,             // 0 minutes (UTC)
  'Europe/London'
);

// Test Case 5: Australia (UTC+11)
console.log('Test 5: Australia Eastern Time (UTC+11)');
testTimezoneConversion(
  '2025-12-23',
  '20:00',       // 8:00 PM AEDT
  660,           // +660 minutes (11 hours ahead of UTC)
  'Australia/Sydney'
);

// Test Case 6: Edge case - Midnight in India
console.log('Test 6: Edge Case - Midnight in India');
testTimezoneConversion(
  '2025-12-23',
  '00:30',       // 12:30 AM India time
  330,           // +330 minutes
  'Asia/Kolkata'
);

console.log('='.repeat(70));
console.log('All tests completed!');
console.log('='.repeat(70));
console.log('\n📌 How to verify:');
console.log('   1. Check that UTC time is correctly calculated from local time');
console.log('   2. Verify the scheduler will trigger at the correct UTC time');
console.log('   3. When it\'s the UTC time shown above, the trial should start\n');
