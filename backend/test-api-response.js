// Quick test to check what the API is actually returning
const fetch = require('node-fetch');

async function testAPI() {
  try {
    const date = '2025-12-31'; // Your case date
    const url = `http://localhost:5000/api/admin/calendar/cases-by-date?date=${date}`;

    console.log('🔍 Testing API endpoint:', url);
    console.log('📅 Date:', date);
    console.log('\n');

    // Note: You'll need to add your admin token here
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    console.log('✅ Response received!\n');

    if (data.cases && data.cases.length > 0) {
      const firstCase = data.cases[0];
      console.log(`📋 Case: ${firstCase.CaseTitle} (ID: ${firstCase.CaseId})`);
      console.log(`👥 Approved Juror Count: ${firstCase.approvedJurorCount}`);
      console.log(`👥 Witnesses array: ${firstCase.witnesses ? 'EXISTS' : 'MISSING'} (${firstCase.witnesses?.length || 0} items)`);
      console.log(`👥 Jurors array: ${firstCase.jurors ? 'EXISTS ✅' : 'MISSING ❌'} (${firstCase.jurors?.length || 0} items)`);
      console.log(`📝 JuryQuestions array: ${firstCase.juryQuestions ? 'EXISTS' : 'MISSING'} (${firstCase.juryQuestions?.length || 0} items)`);

      if (firstCase.jurors) {
        console.log('\n✅ JURORS ARRAY FOUND!');
        console.log('Jurors:', JSON.stringify(firstCase.jurors, null, 2));
      } else {
        console.log('\n❌ JURORS ARRAY IS MISSING!');
        console.log('This means the backend code changes are not active.');
        console.log('\n🔧 Troubleshooting steps:');
        console.log('1. Make sure you restarted the backend server');
        console.log('2. Check if backend is running from the correct directory');
        console.log('3. Check backend console for errors');
      }
    } else {
      console.log('❌ No cases found for this date');
    }

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    console.log('\n💡 Make sure:');
    console.log('1. Backend server is running on http://localhost:5000');
    console.log('2. You have a valid admin token');
  }
}

testAPI();
