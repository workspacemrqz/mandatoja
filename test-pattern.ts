const message = "estou com você";

// Test different patterns
const patterns = [
  /\b(estou|estamos|tô|to)\s+com\s+(voc[êe]|você|vc)\b/i,  // Current pattern
  /(estou|estamos|tô|to)\s+com\s+(voc[êe]|você|vc)/i,  // Without word boundaries
  /\bestou\s+com\s+você/i,  // Simple direct pattern
  /estou\s+com\s+você/i,  // Even simpler
];

console.log(`Testing message: "${message}"\n`);
patterns.forEach((pattern, index) => {
  console.log(`Pattern ${index + 1}: ${pattern}`);
  console.log(`  Match: ${pattern.test(message)}`);
  console.log(`  Result: ${message.match(pattern)?.[0] || 'no match'}\n`);
});
