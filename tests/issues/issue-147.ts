import GoogleDMP from "diff-match-patch";
import * as SanityDMP from "@sanity/diff-match-patch";

console.log("=== Testing Issue #147: Newline / Patch application edge case ===");

const rawPatch147 = `@@ -1,5 +1,5 @@
 A
 B
-C
+XYZ
 D
-E
`;

const fileA = `A\nB\nC\nD\nE`;
const expectedOutput = `A\nB\nXYZ\nD`;

console.log("Input file:\n", JSON.stringify(fileA));
console.log("Patch from issue description:\n", rawPatch147);

// 1. Google DMP
try {
  const dmp = new GoogleDMP();
  const patches = dmp.patch_fromText(rawPatch147);
  console.log("Google DMP parsed patches:", patches);
  const [result, applied] = dmp.patch_apply(patches, fileA);
  console.log("Google DMP result:\n", JSON.stringify(result));
  console.log("Google DMP applied status:", applied);
  console.log("Matches reporter's observed result ('A\\nB\\nXYZD\\nE')?", result === "A\nB\nXYZD\nE");
  console.log("Matches reporter's desired result ('A\\nB\\nXYZ\\nD')?", result === expectedOutput);
} catch (err: any) {
  console.log("Google DMP error:", err.message);
}

// 2. What if the unified diff header is valid? (start + length: -1,5 +1,4)
const correctedPatch = `@@ -1,5 +1,4 @@
 A
 B
-C
+XYZ
 D
-E
`;

console.log("\nTesting with corrected patch header (-1,5 +1,4):");
try {
  const dmp = new GoogleDMP();
  const patches = dmp.patch_fromText(correctedPatch);
  const [result, applied] = dmp.patch_apply(patches, fileA);
  console.log("Google DMP with corrected patch result:\n", JSON.stringify(result));
  console.log("Google DMP applied status:", applied);
} catch (err: any) {
  console.log("Google DMP error:", err.message);
}

// 3. What if patch_make is used natively on the two strings?
const textOriginal = "A\nB\nC\nD\nE";
const textDesired = "A\nB\nXYZ\nD";
const dmp = new GoogleDMP();
const nativePatches = dmp.patch_make(textOriginal, textDesired);
const serialized = dmp.patch_toText(nativePatches);
console.log("\nNative DMP patch_make serialization:\n", serialized);
const [nativeResult, nativeApplied] = dmp.patch_apply(nativePatches, textOriginal);
console.log("Native DMP roundtrip result:\n", JSON.stringify(nativeResult), "applied:", nativeApplied);

// 4. Sanity DMP test with rawPatch147
console.log("\nTesting Sanity DMP with rawPatch147:");
try {
  const parsed = SanityDMP.parsePatch(rawPatch147);
  console.log("Sanity DMP parsed:", parsed);
  const [sanityResult, sanityApplied] = SanityDMP.applyPatches(parsed, fileA);
  console.log("Sanity DMP result:\n", JSON.stringify(sanityResult), "applied:", sanityApplied);
} catch (err: any) {
  console.log("Sanity DMP error:", err.message);
}
