import GoogleDMP from "diff-match-patch";
import * as SanityDMP from "@sanity/diff-match-patch";
import * as jsdiff from "diff";
import fastDiff from "fast-diff";

interface TestCase {
  name: string;
  category: string;
  text1: string;
  text2: string;
  description: string;
}

const testCases: TestCase[] = [
  {
    name: "surrogate_pairs_basic",
    category: "UTF-16 Surrogate Pairs",
    text1: "Hello 🌍 world!",
    text2: "Hello 🪐 world!",
    description: "Single surrogate pair replacement (Earth to Saturn, U+1F30E vs U+1FA90)"
  },
  {
    name: "surrogate_pair_split_margin",
    category: "UTF-16 Surrogate Pairs",
    text1: "🧮 **a",
    text2: "🧮 **",
    description: "Issue #149 trigger: Margin splits surrogate pair in patch generation"
  },
  {
    name: "astral_code_points",
    category: "Unicode Code Points",
    text1: "Math: 𝕏 ⊆ 𝕐 and 𝔄 ⊗ 𝔅",
    text2: "Math: 𝕏 ⊂ 𝕐 and 𝔄 ⊕ 𝔅",
    description: "Mathematical alphanumeric symbols in SMP (Plane 1, > U+FFFF)"
  },
  {
    name: "combining_marks_decomposed",
    category: "Combining Marks",
    text1: "cafe\u0301 au lait", // café using combining acute accent U+0301
    text2: "café au lait",     // café using precomposed é U+00E9
    description: "Combining character vs precomposed character"
  },
  {
    name: "combining_mark_edit",
    category: "Combining Marks",
    text1: "e\u0301 (acute)",
    text2: "e\u0300 (grave)",
    description: "Editing only the combining diacritic mark"
  },
  {
    name: "nfc_nfd_normalization",
    category: "NFC/NFD Normalization",
    text1: "Phở bò tái nạm".normalize("NFC"),
    text2: "Phở bò tái nạm".normalize("NFD"),
    description: "Vietnamese text in NFC vs NFD canonical forms"
  },
  {
    name: "cjk_multibyte",
    category: "CJK",
    text1: "東京は日本の首都です。人口は約1400万人です。",
    text2: "京都は日本の古い首都です。人口は約140万人です。",
    description: "Japanese Kanji/Hiragana text with character insertions and deletions"
  },
  {
    name: "cjk_chinese_classical",
    category: "CJK",
    text1: "道可道，非常道。名可名，非常名。",
    text2: "道可道也，非恒道也。名可名也，非恒名也。",
    description: "Classical Chinese text diff"
  },
  {
    name: "rtl_arabic_hebrew",
    category: "RTL Text",
    text1: "مرحبا بكم في عالم البرمجة",
    text2: "أهلا وسهلا بكم في عالم تطوير البرمجيات",
    description: "Arabic RTL text diff with bidirectional phrases"
  },
  {
    name: "rtl_bidi_mixed",
    category: "RTL Text",
    text1: "User אברהם updated commit abc1234 yesterday",
    text2: "User יצחק deleted commit def5678 today",
    description: "Mixed BiDi text containing English, Hebrew, and commit hashes"
  },
  {
    name: "emoji_zwj_sequence",
    category: "Emoji Sequences & ZWJ",
    text1: "Family: 👨‍👩‍👧‍👦", // Man + ZWJ + Woman + ZWJ + Girl + ZWJ + Boy
    text2: "Family: 👨‍👩‍👦",    // Man + ZWJ + Woman + ZWJ + Boy
    description: "Complex emoji ZWJ family sequence editing"
  },
  {
    name: "emoji_skin_tone_modifiers",
    category: "Emoji Modifiers",
    text1: "Thumbs up: 👍 (default yellow)",
    text2: "Thumbs up: 👍🏽 (medium skin tone U+1F3FD)",
    description: "Fitzpatrick skin-tone modifier insertion"
  },
  {
    name: "emoji_flag_sequences",
    category: "Emoji Sequences",
    text1: "Flag: 🇻🇳 (Vietnam: Regional Indicator V + N)",
    text2: "Flag: 🇯🇵 (Japan: Regional Indicator J + P)",
    description: "Regional indicator pair change"
  },
  {
    name: "newline_lf_vs_crlf",
    category: "Line Endings",
    text1: "Line 1\nLine 2\nLine 3\n",
    text2: "Line 1\r\nLine 2\r\nLine 3\r\n",
    description: "LF to CRLF entire file newline change"
  },
  {
    name: "newline_mixed_cr_lf_crlf",
    category: "Line Endings",
    text1: "Header\r\nItem 1\nItem 2\rItem 3\r\nFooter",
    text2: "Header\nItem 1\nItem 2\nItem 3\nFooter",
    description: "Normalization of mixed CR, LF, CRLF"
  }
];

function testGoogleDMP(tc: TestCase) {
  const dmp = new GoogleDMP();
  try {
    const diffs = dmp.diff_main(tc.text1, tc.text2);
    dmp.diff_cleanupSemantic(diffs);
    
    // Check reconstruction
    const reconstructed = diffs.reduce((acc, [op, text]) => (op >= 0 ? acc + text : acc), "");
    const diffOk = reconstructed === tc.text2;
    
    // Check patch creation and serialization
    let patchOk = false;
    let patchError: string | null = null;
    let patchRoundtripOk = false;
    try {
      const patches = dmp.patch_make(tc.text1, tc.text2);
      const textPatch = dmp.patch_toText(patches);
      const parsedPatches = dmp.patch_fromText(textPatch);
      const [appliedText, results] = dmp.patch_apply(parsedPatches, tc.text1);
      patchOk = true;
      patchRoundtripOk = (appliedText === tc.text2) && results.every(Boolean);
    } catch (e: any) {
      patchError = e.message;
    }

    return {
      engine: "Google DMP",
      diffOk,
      patchOk,
      patchError,
      patchRoundtripOk,
      diffCount: diffs.length
    };
  } catch (err: any) {
    return { engine: "Google DMP", error: err.message };
  }
}

function testSanityDMP(tc: TestCase) {
  try {
    const diffs = SanityDMP.makeDiff(tc.text1, tc.text2);
    SanityDMP.cleanupSemantic(diffs);
    
    const reconstructed = diffs.reduce((acc, [op, text]) => (op >= 0 ? acc + text : acc), "");
    const diffOk = reconstructed === tc.text2;

    let patchOk = false;
    let patchError: string | null = null;
    let patchRoundtripOk = false;
    try {
      const patches = SanityDMP.makePatches(tc.text1, tc.text2);
      const textPatch = SanityDMP.stringifyPatches(patches);
      const parsedPatches = SanityDMP.parsePatch(textPatch);
      const [appliedText, results] = SanityDMP.applyPatches(parsedPatches, tc.text1);
      patchOk = true;
      patchRoundtripOk = (appliedText === tc.text2) && results.every(Boolean);
    } catch (e: any) {
      patchError = e.message;
    }

    return {
      engine: "Sanity DMP",
      diffOk,
      patchOk,
      patchError,
      patchRoundtripOk,
      diffCount: diffs.length
    };
  } catch (err: any) {
    return { engine: "Sanity DMP", error: err.message };
  }
}

function testJSDiff(tc: TestCase) {
  try {
    const diffs = jsdiff.diffChars(tc.text1, tc.text2);
    const reconstructed = diffs.reduce((acc, part) => (part.removed ? acc : acc + part.value), "");
    const diffOk = reconstructed === tc.text2;

    // Test patch creation via jsdiff.createPatch
    let patchOk = false;
    let patchError: string | null = null;
    let patchRoundtripOk = false;
    try {
      const patchStr = jsdiff.createPatch("file.txt", tc.text1, tc.text2);
      const applied = jsdiff.applyPatch(tc.text1, patchStr);
      patchOk = typeof applied === "string";
      patchRoundtripOk = applied === tc.text2;
      if (applied === false) {
        patchError = "applyPatch returned false";
      }
    } catch (e: any) {
      patchError = e.message;
    }

    return {
      engine: "jsdiff",
      diffOk,
      patchOk,
      patchError,
      patchRoundtripOk,
      diffCount: diffs.length
    };
  } catch (err: any) {
    return { engine: "jsdiff", error: err.message };
  }
}

function testFastDiff(tc: TestCase) {
  try {
    const diffs = fastDiff(tc.text1, tc.text2);
    const reconstructed = diffs.reduce((acc, [op, text]) => (op >= 0 ? acc + text : acc), "");
    const diffOk = reconstructed === tc.text2;

    return {
      engine: "fast-diff",
      diffOk,
      patchOk: "N/A (diff-only)",
      patchError: null,
      patchRoundtripOk: "N/A",
      diffCount: diffs.length
    };
  } catch (err: any) {
    return { engine: "fast-diff", error: err.message };
  }
}

console.log("=== RUNNING UNICODE AND TEXT SEMANTICS SUITE ===\n");

const results: any[] = [];

for (const tc of testCases) {
  console.log(`\n--- [${tc.category}] ${tc.name} ---`);
  console.log(`Desc: ${tc.description}`);
  
  const g = testGoogleDMP(tc);
  const s = testSanityDMP(tc);
  const j = testJSDiff(tc);
  const f = testFastDiff(tc);
  
  console.log(`Google DMP: diffOk=${g.diffOk}, patchOk=${g.patchOk}, patchRoundtrip=${g.patchRoundtripOk}${g.patchError ? ` [ERR: ${g.patchError}]` : ""}`);
  console.log(`Sanity DMP: diffOk=${s.diffOk}, patchOk=${s.patchOk}, patchRoundtrip=${s.patchRoundtripOk}${s.patchError ? ` [ERR: ${s.patchError}]` : ""}`);
  console.log(`jsdiff:     diffOk=${j.diffOk}, patchOk=${j.patchOk}, patchRoundtrip=${j.patchRoundtripOk}${j.patchError ? ` [ERR: ${j.patchError}]` : ""}`);
  console.log(`fast-diff:  diffOk=${f.diffOk}`);
  
  results.push({ testCase: tc, google: g, sanity: s, jsdiff: j, fastDiff: f });
}
