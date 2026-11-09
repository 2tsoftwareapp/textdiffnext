import * as SanityDMP from "@sanity/diff-match-patch";

const t1 = "Flag: 🇻🇳 (Vietnam: Regional Indicator V + N)";
const t2 = "Flag: 🇯🇵 (Japan: Regional Indicator J + P)";

console.log("=== Probing Sanity DMP Flag Sequence ===");
const diffs = SanityDMP.makeDiff(t1, t2);
console.log("Raw diffs:", JSON.stringify(diffs));

SanityDMP.cleanupSemantic(diffs);
console.log("Semantic diffs:", JSON.stringify(diffs));

try {
  const patches = SanityDMP.makePatches(t1, t2);
  console.log("Patches:", JSON.stringify(patches, null, 2));
  const str = SanityDMP.stringifyPatches(patches);
  console.log("Stringified:", str);
} catch (e: any) {
  console.log("Caught error:", e);
}
