# TextDiffNext — Milestone 1 Regression Test Results

## Test Suite Execution Summary
- **Test Runner**: Bun Test (`bun test tests/milestone1_regression.test.ts`)
- **Runtime**: Bun `1.4.4` (macOS arm64, Darwin 26.6.2)
- **Status**: **PASS (10/10 tests, 47 assertions passing, 0 failures)**
- **Duration**: ~300ms

---

## Detailed Test Matrix

| # | Test Category | Target Scenarios | Verification Points | Result |
|---|---|---|---|---|
| 1 | **ASCII** | Prose edits, word replacements | Exact output, hunk booleans `[true]` | **PASS** |
| 2 | **BMP Unicode** | Vietnamese (Tiếng Việt), Cyrillic (Привет мир), CJK (こんにちは世界) | Multi-byte UTF-8 string integrity, exact text match | **PASS** |
| 3 | **Astral Unicode** | Emojis (`🌍`, `🌏`, `🍎`, `🍌`, `⭐`, `🌟`), Supplementary planes | In-memory code-unit patch apply; full serialization with intact pairs | **PASS** |
| 4 | **Repetitive Source Code** | `repetitive_lines` corpus (loops, repetitive structure) | Exact roundtrip, 100% hunk success | **PASS** |
| 5 | **45 KB Code Long Corpus** | `code_long_a.ts` -> `code_long_b.ts` (115 hunks) | **TextDiffNext**: Exact match (115/115 hunks). **Sanity**: Silent corruption reproduced and validated. | **PASS** |
| 6 | **75 KB Large File** | `large_file_a.txt` -> `large_file_b.txt` (64 KB -> 75 KB) | Exact reconstruction, high-volume hunks | **PASS** |
| 7 | **Distributed Edits** | `sparse_edits_a.txt` -> `sparse_edits_b.txt` | Distributed offsets across 64 KB buffer | **PASS** |
| 8 | **Multiple Patch Hunks** | `sparse_edits` & `data_long` | Multi-hunk rolling context integrity | **PASS** |
| 9 | **Shifted Context (Fuzzy)** | `drifted_patch_base.txt`, `modified`, `target` | Bitap fuzzy match tolerance, offset delta adjustment | **PASS** |
| 10 | **Serialization / Deserialization** | TypeScript interface edits | Roundtrip stringification, header syntax `@@ -s1,l1 +s2,l2 @@`, parsed object equality | **PASS** |
| 11 | **Cross-Engine Differential** | Google DMP vs TextDiffNext | TDN parses & applies Google patch string (100% match); Google parses & applies TDN patch string (100% match) | **PASS** |

---

## Root Cause Verification Evidence: Code Long

In the 45 KB `code_long` scenario with 115 hunks:
- **Sanity DMP**:
  - `reconstructed === b`: `false` (FAILED)
  - `results.every(Boolean)`: `true` (SILENT CORRUPTION)
  - Corrupted hunk: Patch 103 (target offset 21,341 clamped to 21,158). It mistakenly modified `ServiceHandler_133` instead of `ServiceHandler_135`.
- **TextDiffNext**:
  - `reconstructed === b`: `true` (PASS)
  - `results.every(Boolean)`: `true` (PASS, 115/115 true)
  - Character accuracy: 100.00% exact match across all 21,800 characters.

In the 240-hunk `data_long` JSON scenario:
- **Sanity DMP**: `false` (corrupted)
- **TextDiffNext**: `true` (exact match across 240/240 hunks)
