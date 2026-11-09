import * as fs from "fs";
import * as path from "path";

const CORPUS_DIR = path.join(__dirname);

function write(name: string, content: string) {
  fs.writeFileSync(path.join(CORPUS_DIR, name), content, "utf8");
}

console.log("Generating benchmark corpus...");

// 1. Short Prose
const proseShortA = `The art of computer programming is a vast landscape of algorithms, data structures, and human creativity. In the early days, programmers wrote machine code directly into magnetic drum memories. Over time, higher-level abstractions emerged, allowing engineers to express complex logic in human-readable terms.`;
const proseShortB = `The craft of computer programming is an evolving landscape of algorithms, distributed architectures, and human creativity. In the early decades, programmers wrote assembly instructions directly into magnetic core memories. Over time, high-level abstractions emerged, allowing engineers to express intricate logic in concise syntax.`;
write("prose_short_a.txt", proseShortA);
write("prose_short_b.txt", proseShortB);

// 2. Long Prose
const paragraph = `Software evolution is an inevitable phenomenon in software engineering. As systems grow in complexity, the maintenance of historical revisions and the reconciliation of parallel edits becomes paramount. Different algorithms address this challenge through various heuristics, ranging from character-level dynamic programming to tokenized AST comparisons.\n\n`;
let proseLongA = "";
let proseLongB = "";
for (let i = 0; i < 40; i++) {
  proseLongA += `Section ${i + 1}: Foundations\n` + paragraph;
  if (i % 3 === 0) {
    proseLongB += `Section ${i + 1}: Theoretical Foundations and Practical Implementations\n` + paragraph.replace("inevitable", "unavoidable").replace("paramount", "critical");
  } else if (i % 5 === 0) {
    proseLongB += `Section ${i + 1}: Foundations (Revised)\n` + paragraph + "Note: Supplementary analysis added here.\n\n";
  } else {
    proseLongA += paragraph;
    proseLongB += paragraph;
  }
}
write("prose_long_a.txt", proseLongA);
write("prose_long_b.txt", proseLongB);

// 3. Source Code Short
const codeShortA = `export function processEvents(events: Event[]): Result {
  const output: Item[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'ACTION') {
      output.push({ id: e.id, value: e.payload.amount * 1.05 });
    }
  }
  return { count: output.length, items: output };
}`;
const codeShortB = `export function processEvents(events: readonly Event[], options: ProcessOptions = {}): Result {
  const output: Item[] = [];
  const taxRate = options.taxRate ?? 1.05;
  for (const e of events) {
    if (e.type === 'ACTION' && !e.discarded) {
      output.push({ id: e.id, value: Math.round(e.payload.amount * taxRate * 100) / 100 });
    }
  }
  return { count: output.length, items: output, timestamp: Date.now() };
}`;
write("code_short_a.ts", codeShortA);
write("code_short_b.ts", codeShortB);

// 4. Source Code Long (600 lines)
let codeLongA = "/* System Architecture Definitions */\n";
let codeLongB = "/* System Architecture Definitions (v2.1) */\n";
for (let i = 0; i < 150; i++) {
  codeLongA += `export interface ServiceHandler_${i} {\n  id: string;\n  process(req: Request_${i}): Promise<Response_${i}>;\n  validate(data: unknown): boolean;\n}\n\n`;
  if (i % 4 === 0) {
    codeLongB += `export interface ServiceHandler_${i} {\n  id: string;\n  version: number;\n  process(req: Request_${i}, ctx: Context): Promise<Response_${i}>;\n  validate(data: unknown): boolean;\n  teardown?(): Promise<void>;\n}\n\n`;
  } else {
    codeLongB += `export interface ServiceHandler_${i} {\n  id: string;\n  process(req: Request_${i}): Promise<Response_${i}>;\n  validate(data: unknown): boolean;\n}\n\n`;
  }
}
write("code_long_a.ts", codeLongA);
write("code_long_b.ts", codeLongB);

// 5. JSON Short & Long
const jsonShortA = JSON.stringify({ name: "TextDiffNext", version: "0.1.0", author: "Hermes", private: true, dependencies: { dmp: "^1.0.5" } }, null, 2);
const jsonShortB = JSON.stringify({ name: "TextDiffNext", version: "0.2.0-alpha", author: "Hermes Agent", private: true, dependencies: { "@sanity/diff-match-patch": "^3.2.1" }, license: "Apache-2.0" }, null, 2);
write("data_short_a.json", jsonShortA);
write("data_short_b.json", jsonShortB);

const jsonTreeA: any = { schema: "v1", records: [] };
const jsonTreeB: any = { schema: "v2", records: [] };
for (let i = 0; i < 400; i++) {
  jsonTreeA.records.push({ id: `rec_${i}`, score: i * 1.5, status: i % 2 === 0 ? "active" : "pending", tags: ["diff", `tag_${i}`] });
  if (i % 5 === 0) {
    jsonTreeB.records.push({ id: `rec_${i}`, score: i * 2.0, status: "completed", tags: ["diff", "verified", `tag_${i}`], updated: true });
  } else {
    jsonTreeB.records.push({ id: `rec_${i}`, score: i * 1.5, status: i % 2 === 0 ? "active" : "pending", tags: ["diff", `tag_${i}`] });
  }
}
write("data_long_a.json", JSON.stringify(jsonTreeA, null, 2));
write("data_long_b.json", JSON.stringify(jsonTreeB, null, 2));

// 6. Markdown Dense
const mdA = `# Research Feasibility Spike
## Executive Summary
This document outlines the comparative analysis of diff algorithms.

### Benchmark Setup
| Engine | Myers | Bitap | UTF-8 |
|---|---|---|---|
| Google DMP | Yes | Yes | Partial |
| Sanity DMP | Yes | Yes | Improved |
| jsdiff | Yes | No | Full |

- Requirement 1: Preserve character indices
- Requirement 2: Fast execution on long lines
`;
const mdB = `# Research Feasibility Spike — TextDiffNext
## Executive Summary & Recommendations
This technical report details the comparative empirical benchmarks of diff and fuzzy-patch algorithms.

### Benchmark Setup & Engine Matrix
| Engine | Myers | Bitap | Unicode Safety | Speed |
|---|---|---|---|---|
| Google DMP | Yes | Yes | Broken (#149) | Moderate |
| Sanity DMP | Yes | Yes | Partial (Surrogate Edge Cases) | Moderate |
| jsdiff | Yes | No | Full Code Point | Slower on chars |
| fast-diff | Yes | No | Full Code Unit | High |

- Requirement 1: Zero regression on surrogate pairs and grapheme clusters
- Requirement 2: Bounded execution under pathological inputs
- Requirement 3: Streaming / chunked diff support
`;
write("markdown_a.md", mdA);
write("markdown_b.md", mdB);

// 7. Large File (150KB)
let largeA = "";
let largeB = "";
for (let i = 0; i < 3000; i++) {
  largeA += `LOG [2026-11-09T14:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z] Worker ${i % 8}: Connection established with pool ${i % 3}\n`;
  if (i % 50 === 0) {
    largeB += `LOG [2026-11-09T14:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z] Worker ${i % 8}: Connection REJECTED with pool ${i % 3} (error: timeout)\n`;
  } else {
    largeB += `LOG [2026-11-09T14:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z] Worker ${i % 8}: Connection established with pool ${i % 3}\n`;
  }
}
write("large_file_a.txt", largeA);
write("large_file_b.txt", largeB);

// 8. Repetitive Lines
let repA = "";
let repB = "";
for (let i = 0; i < 1500; i++) {
  repA += "echo 'repeated identical line content pattern';\n";
  if (i === 750) {
    repB += "echo 'altered middle line content pattern';\n";
  } else {
    repB += "echo 'repeated identical line content pattern';\n";
  }
}
write("repetitive_lines_a.txt", repA);
write("repetitive_lines_b.txt", repB);

// 9. Sparse Edits
let sparseA = "";
let sparseB = "";
for (let i = 0; i < 2000; i++) {
  const line = `Index entry #${i}: UUID=${i * 31337 + 101}\n`;
  sparseA += line;
  if (i === 100 || i === 1000 || i === 1900) {
    sparseB += `Index entry #${i}: UUID=${i * 31337 + 999} [UPDATED]\n`;
  } else {
    sparseB += line;
  }
}
write("sparse_edits_a.txt", sparseA);
write("sparse_edits_b.txt", sparseB);

// 10. Dense Edits
let denseA = "";
let denseB = "";
for (let i = 0; i < 500; i++) {
  denseA += `Token_${i}_Alpha `;
  denseB += (i % 2 === 0) ? `Token_${i}_Beta ` : `Token_${i}_Alpha `;
}
write("dense_edits_a.txt", denseA);
write("dense_edits_b.txt", denseB);

// 11. Completely Different Texts
write("completely_different_a.txt", "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.".repeat(15));
write("completely_different_b.txt", "To be, or not to be, that is the question: Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles and by opposing end them. To die—to sleep, no more; and by a sleep to say we end the heart-ache.".repeat(15));

// 12. Long Single Line (30,000 chars)
let singleA = "";
let singleB = "";
for (let i = 0; i < 1000; i++) {
  singleA += `key${i}=val${i}&`;
  if (i % 40 === 0) {
    singleB += `key${i}=MODIFIED_${i}&`;
  } else {
    singleB += `key${i}=val${i}&`;
  }
}
write("long_single_line_a.txt", singleA);
write("long_single_line_b.txt", singleB);

// 13. Unicode Heavy Inputs
const uniA = `Internationalization:
1. Emojis: 🚀 ✨ 🪐 🧮 👨‍👩‍👧‍👦 🇻🇳 🇯🇵
2. CJK: 東京は日本の首都です。道可道，非常道。
3. RTL: مرحبا بالعالم العربي / שלום עולם
4. Diacritics: Tiếng Việt có dấu: Phở bò tái nạm, café au lait
5. Math SMP: 𝕏 ⊂ 𝕐, 𝔄 ⊗ 𝔅
`;
const uniB = `Internationalization & Localization (Updated):
1. Emojis: 🚀 🌟 🪐 🧮 👨‍👩‍👦 🇻🇳 🇬🇧
2. CJK: 京都は日本の古い文化首都です。道可道也，非恒道也。
3. RTL: أهلاً وسهلاً بالعالم العربي / שלום לכולם
4. Diacritics: Tiếng Việt chuẩn: Phở gà đặc biệt, café au lait (NFD)
5. Math SMP: 𝕏 ⊆ 𝕐, 𝔄 ⊕ 𝔅
`;
write("unicode_heavy_a.txt", uniA);
write("unicode_heavy_b.txt", uniB);

// 14. Newline Edge Cases
const nlA = "Header\r\nLine 1\nLine 2\rLine 3\r\nLine 4\nNoTrailingNewline";
const nlB = "Header\nLine 1\nLine 2 (edited)\nLine 3\nLine 4\nNoTrailingNewline\n";
write("newline_edge_cases_a.txt", nlA);
write("newline_edge_cases_b.txt", nlB);

// 15. Drifted Patch Scenario
const driftBase = `class DataStore {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, val) {
    this.cache.set(key, val);
  }
}`;

const driftMod = `class DataStore {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) throw new Error("Key not found");
    return this.cache.get(key);
  }

  set(key, val) {
    this.cache.set(key, val);
  }
}`;

// Target has shifted line numbers AND minor renaming around it
const driftTarget = `// Copyright 2026 Company
// Preceding comments line 1
// Preceding comments line 2
// Preceding comments line 3

class CacheStore {
  constructor() {
    this.cache = new Map();
    this.hits = 0;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, val) {
    this.cache.set(key, val);
  }
}`;
write("drifted_patch_base.txt", driftBase);
write("drifted_patch_modified.txt", driftMod);
write("drifted_patch_target.txt", driftTarget);

console.log("Corpus generation complete: 15 scenarios created.");
