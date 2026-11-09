import GoogleDMP from "diff-match-patch";
import * as SanityDMP from "@sanity/diff-match-patch";
import * as jsdiff from "diff";
import fastDiff from "fast-diff";

console.log("=== FUNCTIONAL COMPARISON: DIFF, MATCH, PATCH ===\n");

// 1. DIFF CORRECTNESS & DETERMINISM
console.log("--- 1. Diff Correctness & Determinism ---");
const testPairs = [
  { name: "identical", a: "hello world", b: "hello world" },
  { name: "simple edit", a: "the quick brown fox", b: "the fast brown dog" },
  { name: "deletion only", a: "abcdefghijklmnop", b: "afghijklmnop" },
  { name: "insertion only", a: "abc", b: "a123bc" },
  { name: "transposition", a: "cats and dogs", b: "dogs and cats" },
  { name: "empty to full", a: "", b: "brand new content" },
  { name: "full to empty", a: "deleted all content", b: "" }
];

for (const pair of testPairs) {
  const gDmp = new GoogleDMP();
  const gDiff = gDmp.diff_main(pair.a, pair.b);
  const sDiff = SanityDMP.makeDiff(pair.a, pair.b);
  const fDiff = fastDiff(pair.a, pair.b);
  const jDiff = jsdiff.diffChars(pair.a, pair.b);

  // Determinism check (run 3 times)
  const gDiff2 = gDmp.diff_main(pair.a, pair.b);
  const isGDeterministic = JSON.stringify(gDiff) === JSON.stringify(gDiff2);

  // Reconstruction
  const gRec = gDiff.reduce((acc, [op, t]) => op >= 0 ? acc + t : acc, "");
  const sRec = sDiff.reduce((acc, [op, t]) => op >= 0 ? acc + t : acc, "");
  const fRec = fDiff.reduce((acc, [op, t]) => op >= 0 ? acc + t : acc, "");
  const jRec = jDiff.reduce((acc, p) => p.removed ? acc : acc + p.value, "");

  console.log(`Pair [${pair.name}]: gOk=${gRec === pair.b}, sOk=${sRec === pair.b}, fOk=${fRec === pair.b}, jOk=${jRec === pair.b}, gDet=${isGDeterministic}`);
}

// 2. MATCH: FUZZY MATCHING ACCURACY & LOCATION WEIGHTING (BITAP)
console.log("\n--- 2. Match: Fuzzy Matching Accuracy & Location Weighting ---");
// Google DMP and Sanity DMP implement Bitap match_main
const matchEngineGoogle = new GoogleDMP();
matchEngineGoogle.Match_Threshold = 0.5;
matchEngineGoogle.Match_Distance = 1000;

const matchText = "The quick brown fox jumps over the lazy dog in the sunny meadow.";
const exactPattern = "jumps over";
const fuzzyPattern = "jumpz ovr"; // 2 typos

const gMatchExact = matchEngineGoogle.match_main(matchText, exactPattern, 0);
const gMatchFuzzy = matchEngineGoogle.match_main(matchText, fuzzyPattern, 0);
const sMatchExact = SanityDMP.match(matchText, exactPattern, 0, { threshold: 0.5, distance: 1000 });
const sMatchFuzzy = SanityDMP.match(matchText, fuzzyPattern, 0, { threshold: 0.5, distance: 1000 });

console.log(`Exact Match ("jumps over"): Google idx=${gMatchExact}, Sanity idx=${sMatchExact}`);
console.log(`Fuzzy Match ("jumpz ovr"): Google idx=${gMatchFuzzy}, Sanity idx=${sMatchFuzzy}`);

// Test location weighting: if pattern occurs at pos 10 and pos 50, where does loc point?
const repeatedText = "apple orange banana grape apple orange banana grape";
const loc10 = matchEngineGoogle.match_main(repeatedText, "banana", 10);
const loc35 = matchEngineGoogle.match_main(repeatedText, "banana", 35);
console.log(`Location weighting: loc hint 10 -> ${loc10}, loc hint 35 -> ${loc35}`);

// Does jsdiff or fast-diff support fuzzy match?
console.log("jsdiff fuzzy match support: No (Strict Myers diff only)");
console.log("fast-diff fuzzy match support: No (Strict Myers diff only)");

// 3. PATCH APPLICATION ON UNCHANGED, SHIFTED, AND DRIFTED SOURCE
console.log("\n--- 3. Patch Application: Unchanged, Shifted, and Drifted ---");
const baseDoc = `function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return total;
}`;

const modifiedDoc = `function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    if (!item.price) continue;
    total += item.price * item.quantity;
  }
  return total;
}`;

// Unchanged patch
const gPatches = matchEngineGoogle.patch_make(baseDoc, modifiedDoc);
const [gUnchanged, gUnchangedRes] = matchEngineGoogle.patch_apply(gPatches, baseDoc);
console.log(`Unchanged source patch apply: success=${gUnchanged === modifiedDoc}, results=${JSON.stringify(gUnchangedRes)}`);

// Shifted source (inserted 10 lines at top)
const shiftedDoc = `// Header comments\n// Author: Alice\n// License: MIT\n\n\n\n\n\n` + baseDoc;
const [gShifted, gShiftedRes] = matchEngineGoogle.patch_apply(gPatches, shiftedDoc);
console.log(`Shifted source patch apply: success=${gShifted.includes("item.price * item.quantity")}, results=${JSON.stringify(gShiftedRes)}`);

// Drifted source (minor edits within the context)
const driftedDoc = `function calculateTotal(itemsList) {
  let sum = 0;
  for (const item of itemsList) {
    total += item.price;
  }
  return sum;
}`;
const [gDrifted, gDriftedRes] = matchEngineGoogle.patch_apply(gPatches, driftedDoc);
console.log(`Drifted source patch apply: applied=${JSON.stringify(gDriftedRes)}`);
console.log(`Drifted result snippet:\n`, gDrifted);

// 4. PARTIAL PATCH SUCCESS AND FAILURE REPORTING
console.log("\n--- 4. Partial Patch Success and Failure Reporting ---");
const multiPatchBase = "Part1: AAA\nPart2: BBB\nPart3: CCC\nPart4: DDD\n";
const multiPatchMod  = "Part1: AAA_MOD\nPart2: BBB\nPart3: CCC_MOD\nPart4: DDD\n";
const multiPatches = matchEngineGoogle.patch_make(multiPatchBase, multiPatchMod);
console.log(`Generated ${multiPatches.length} patch hunks`);

// Corrupt Part 1 completely so only Part 3 can apply
const partiallyCorrupted = "SOMETHING TOTALLY WEIRD AND DIFFERENT\nPart2: BBB\nPart3: CCC\nPart4: DDD\n";
const [partialResult, partialStatuses] = matchEngineGoogle.patch_apply(multiPatches, partiallyCorrupted);
console.log(`Partial patch statuses: ${JSON.stringify(partialStatuses)}`);
console.log(`Result contains Part3 CCC_MOD? ${partialResult.includes("CCC_MOD")}`);

// 5. REVERSE PATCHES
console.log("\n--- 5. Reverse Patches ---");
// Google DMP does not have a built-in patch_reverse method, but can you generate reverse by patch_make(b, a)?
const reversePatches = matchEngineGoogle.patch_make(modifiedDoc, baseDoc);
const [revertedDoc, revertRes] = matchEngineGoogle.patch_apply(reversePatches, modifiedDoc);
console.log(`Reverse patch via patch_make(b, a): success=${revertedDoc === baseDoc}, results=${JSON.stringify(revertRes)}`);

// jsdiff has reversePatch
try {
  const jPatch = jsdiff.createPatch("doc.js", baseDoc, modifiedDoc);
  const jParsed = jsdiff.parsePatch(jPatch);
  const jReversed = (jsdiff as any).reversePatch ? (jsdiff as any).reversePatch(jParsed[0]) : null;
  console.log(`jsdiff reversePatch supported? ${jReversed !== null}`);
} catch (e: any) {
  console.log(`jsdiff reversePatch error:`, e.message);
}

// 6. RESOURCE EXHAUSTION AND PATHOLOGICAL INPUTS
console.log("\n--- 6. Pathological Inputs & Timeout / Resource Exhaustion ---");
// Construct repetitive worst-case for Myers diff:
// (a^N b^N) vs (b^N a^N) or long alternating sequences
const N = 4000;
const pathA = "a".repeat(N) + "b".repeat(N);
const pathB = "b".repeat(N) + "a".repeat(N);

const t0 = performance.now();
matchEngineGoogle.Diff_Timeout = 0.5; // 500ms timeout guard
const gPathDiff = matchEngineGoogle.diff_main(pathA, pathB);
const t1 = performance.now();
console.log(`Pathological input (N=${N}): Google DMP took ${(t1 - t0).toFixed(2)}ms (Timeout guard=${matchEngineGoogle.Diff_Timeout}s), diffs=${gPathDiff.length}`);

// Test fast-diff on pathological input
const t2 = performance.now();
const fPathDiff = fastDiff(pathA, pathB);
const t3 = performance.now();
console.log(`Pathological input (N=${N}): fast-diff took ${(t3 - t2).toFixed(2)}ms, diffs=${fPathDiff.length}`);
