import GoogleDMP from "diff-match-patch";
import * as SanityDMP from "@sanity/diff-match-patch";
import { diffWords, diffLines } from "diff";

console.log("=== Testing Issue #142: 'Diff is calculating very wrong results' ===");

// Typical scenario: Paragraph deletion with slight changes at the boundary,
// or repetitive text where Myers finds a minimal edit distance that doesn't match human semantic intuition.

const text1 = `The quick brown fox jumps over the lazy dog.
This is a long paragraph that describes many things in detail.
We are explaining how diff algorithms work and how they process text.
Finally, we conclude with a summary of the findings and results.`;

const text2 = `The quick brown fox jumps over the lazy dog.
Finally, we concluded with a summary of the findings and results.`;

const dmp = new GoogleDMP();

// Raw Myers character diff
const diffsRaw = dmp.diff_main(text1, text2);
console.log("Raw Myers diff count:", diffsRaw.length);

// Semantic cleanup
const diffsSemantic = dmp.diff_main(text1, text2);
dmp.diff_cleanupSemantic(diffsSemantic);
console.log("\nSemantic cleanup diffs:");
diffsSemantic.forEach(([op, text]) => {
  const label = op === 0 ? "EQUAL" : op === -1 ? "DELETE" : "INSERT";
  console.log(`  [${label}]: ${JSON.stringify(text)}`);
});

// Verify reconstruction
const reconstructed = diffsSemantic.reduce((acc, [op, text]) => {
  return op === 0 || op === 1 ? acc + text : acc;
}, "");
console.log("\nReconstructed equals text2?", reconstructed === text2);

// Compare with jsdiff diffLines and diffWords
console.log("\njsdiff diffLines:");
const lineDiff = diffLines(text1, text2);
lineDiff.forEach(part => {
  const status = part.added ? "ADDED" : part.removed ? "REMOVED" : "COMMON";
  console.log(`  [${status}]: ${JSON.stringify(part.value)}`);
});

// Compare with word-level diff
console.log("\njsdiff diffWords:");
const wordDiff = diffWords(text1, text2);
wordDiff.forEach(part => {
  const status = part.added ? "ADDED" : part.removed ? "REMOVED" : "COMMON";
  console.log(`  [${status}]: ${JSON.stringify(part.value)}`);
});
