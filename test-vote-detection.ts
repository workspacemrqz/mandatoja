// Test script to verify vote detection is working correctly
import { analyzeVoteIntent } from './server/lib/vote-intent-detector';

// Test cases with expected results
const testCases = [
  // Rejection cases (should return isSupport: false)
  { message: "não vou votar em você", expectedSupport: false, description: "Direct rejection" },
  { message: "não vou votar em vc", expectedSupport: false, description: "Direct rejection with abbreviation" },
  { message: "desculpa mas não voto em você", expectedSupport: false, description: "Polite rejection" },
  { message: "não apoio sua candidatura", expectedSupport: false, description: "No support" },
  { message: "já tenho meu candidato", expectedSupport: false, description: "Has another candidate" },
  { message: "vou votar em outro", expectedSupport: false, description: "Voting for another" },
  { message: "infelizmente não posso apoiar", expectedSupport: false, description: "Cannot support" },
  { message: "não da para votar em você", expectedSupport: false, description: "Cannot vote" },
  
  // Support cases (should return isSupport: true)
  { message: "vou votar em você", expectedSupport: true, description: "Direct support" },
  { message: "pode contar com meu voto", expectedSupport: true, description: "Count on vote" },
  { message: "meu voto é seu", expectedSupport: true, description: "Vote is yours" },
  { message: "voto confirmado", expectedSupport: true, description: "Confirmed vote" },
  { message: "estou com você", expectedSupport: true, description: "With you" },
  { message: "conte comigo", expectedSupport: true, description: "Count on me" },
  { message: "tamo junto", expectedSupport: true, description: "We're together" },
  { message: "apoio total", expectedSupport: true, description: "Total support" },
];

console.log("========================================");
console.log("TESTING VOTE DETECTION FUNCTIONALITY");
console.log("========================================\n");

let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  const result = analyzeVoteIntent(testCase.message);
  const passed = result.isSupport === testCase.expectedSupport;
  
  if (passed) {
    passedTests++;
    console.log(`✅ Test ${index + 1} PASSED: ${testCase.description}`);
    console.log(`   Message: "${testCase.message}"`);
    console.log(`   Expected support: ${testCase.expectedSupport}, Got: ${result.isSupport}`);
    console.log(`   Confidence: ${result.confidence}\n`);
  } else {
    failedTests++;
    console.log(`❌ Test ${index + 1} FAILED: ${testCase.description}`);
    console.log(`   Message: "${testCase.message}"`);
    console.log(`   Expected support: ${testCase.expectedSupport}, Got: ${result.isSupport}`);
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Reason: ${result.reason}\n`);
  }
});

console.log("========================================");
console.log("TEST RESULTS");
console.log("========================================");
console.log(`Total tests: ${testCases.length}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log(`Success rate: ${((passedTests / testCases.length) * 100).toFixed(1)}%`);

if (failedTests === 0) {
  console.log("\n🎉 All tests passed! Vote detection is working correctly.");
} else {
  console.log("\n⚠️ Some tests failed. Vote detection needs adjustment.");
}
