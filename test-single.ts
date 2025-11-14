import { analyzeVoteIntent } from './server/lib/vote-intent-detector';

const message = "estou com você";
const result = analyzeVoteIntent(message);

console.log("Testing: 'estou com você'");
console.log("Result:", JSON.stringify(result, null, 2));

// Let's test the pattern directly
const pattern = /\b(estou|estamos|tô|to)\s+com\s+(voc[êe]|você|vc)\b/i;
console.log("Pattern test:", pattern.test(message));
