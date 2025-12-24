require('dotenv').config();
const { checkAndTransitionTrials } = require('./jobs/trialScheduler');

console.log('🧪 Testing scheduler manually...');
console.log('This will check all cases and trigger any that are ready for war room');
console.log('');

checkAndTransitionTrials()
  .then(() => {
    console.log('');
    console.log('✅ Test complete - Check logs above to see if any cases were triggered');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
