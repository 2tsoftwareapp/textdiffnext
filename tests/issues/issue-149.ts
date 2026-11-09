import GoogleDMP from "diff-match-patch";
import * as SanityDMP from "@sanity/diff-match-patch";

console.log("=== Testing Issue #149: Unicode Surrogate Pair in Patch Margin ===");

// 1. Google DMP
try {
  const dmp = new GoogleDMP();
  const text1 = "🧮 **a";
  const text2 = "🧮 **";
  const patches = dmp.patch_make(text1, text2);
  console.log("Google DMP patch object diffs[0]:", JSON.stringify(patches[0]?.diffs[0]));
  
  // Try serializing to text (calls encodeURI)
  const patchText = dmp.patch_toText(patches);
  console.log("Google DMP patch_toText succeeded:", patchText);
} catch (err: any) {
  console.log("Google DMP threw error:", err.name, err.message);
}

// 2. Sanity DMP
try {
  console.log("\nTesting Sanity DMP:");
  const text1 = "🧮 **a";
  const text2 = "🧮 **";
  const patches = SanityDMP.makePatches(text1, text2);
  console.log("Sanity DMP patch object diffs[0]:", JSON.stringify(patches[0]?.diffs[0]));
  const patchText = SanityDMP.stringifyPatches(patches);
  console.log("Sanity DMP stringifyPatches succeeded:\n", patchText);
  
  // Also test applying it back
  const [reconstructed, results] = SanityDMP.applyPatches(patches, text1);
  console.log("Sanity DMP applyPatches result:", JSON.stringify(reconstructed), "results:", results);
  console.log("Matches text2?", reconstructed === text2);
} catch (err: any) {
  console.log("Sanity DMP threw error:", err.name, err.message);
}
