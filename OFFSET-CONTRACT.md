# TextDiffNext — Offset Contract & Coordinate System Specification

## Objective & Overview
This document specifies the exact coordinate system and offset contract across all boundaries of TextDiffNext in Milestone 1.

Historically, Google `diff-match-patch` operated entirely in the host language's native string index (UCS-2 / UTF-16 code units in JavaScript and Java, UTF-16 code units in C#, bytes in C++ and Python 2, Unicode codepoints in Python 3). 
Sanity introduced an experimental layer attempting to convert offsets into UTF-8 bytes for serialization, while attempting to convert them back to UCS-2 during deserialization and application. This hybrid approach violated internal invariants and caused offset drift and silent corruption.

TextDiffNext restores a uniform **UTF-16 Code-Unit Contract** across all internal and public interfaces.

---

## 1. Boundary Coordinate Systems

| Subsystem / Boundary | Input Coordinate Unit | Internal Processing Unit | Output Coordinate Unit | Contract Details |
|---|---|---|---|---|
| **Diff Engine (`src/diff/`)** | UTF-16 code unit | UTF-16 code unit | Array of `[DiffType, string]` | Index calculation via `string.length`, `codePointAt`, and `slice`. |
| **Match Engine (`src/match/`)** | UTF-16 code unit | UTF-16 code unit | UTF-16 code unit index | Bitap algorithm searches within string offsets matching JS `indexOf`. |
| **Patch Make (`src/patch/make.ts`)** | UTF-16 code unit | UTF-16 code unit | `Patch` objects (`start1`, `start2` in UTF-16) | Offsets track exact character indices in source texts A and B. |
| **Patch Serialization (`stringify.ts`)** | `Patch` object (UTF-16) | UTF-16 code unit | Google DMP patch text (`@@ -s1,l1 +s2,l2 @@`) | Character positions, not line numbers; nonzero spans use 1-based header starts, zero spans use their 0-based object offsets. |
| **Patch Deserialization (`parse.ts`)** | Google DMP patch text | UTF-16 code unit | `Patch` objects (0-based UTF-16) | Directly populates `start1`, `start2`, `length1`, `length2` without byte compensation. |
| **Patch Apply (`src/patch/apply.ts`)** | `Patch[]` (UTF-16), Base string | UTF-16 code unit | Reconstructed string & `boolean[]` | No index adjustments; preserves exact code-unit targets and delta shifts. |

---

## 2. Detailed Offset Flow Tracing

### A. Diff Output Index Generation
1. Inputs `textA` and `textB` are standard JavaScript strings.
2. In line-mode diffing (`charsToLines`), common lines are mapped to private-use Unicode characters. In character-mode diffing, Myers algorithm compares strings by index.
3. Every diff piece is a tuple `[op, text]`. Its length is measured strictly via `text.length`.

### B. Match Index Calculation
1. `match(text, pattern, loc, options)` takes an integer `loc` representing the expected UTF-16 character index in `text`.
2. Bitap initializes alphabet masks and bit vectors matching UTF-16 code units.
3. The returned score index is a 0-based index in `text` compatible with `text.substring(matchIndex)`.

### C. Patch Object Invariants
The `Patch` interface in `src/patch/createPatchObject.ts` defines:
```ts
export interface Patch {
  diffs: Diff[]
  start1: number // 0-based UTF-16 offset into textA
  start2: number // 0-based UTF-16 offset into textB
  length1: number // UTF-16 length consumed in textA
  length2: number // UTF-16 length produced in textB

  // Deprecated compatibility fields (mirror UTF-16 values):
  utf8Start1?: number
  utf8Start2?: number
  utf8Length1?: number
  utf8Length2?: number
}
```

### D. Patch Context Generation (`addContext`)
1. Context margins are measured in UTF-16 characters (`margin: 4` by default).
2. Lookahead pattern: `pattern = text.substring(patch.start2, patch.start2 + patch.length1)`.
3. If duplicate matches exist, padding increases by `opts.margin` until uniqueness is achieved or `MAX_BITS` (32) is reached.
4. Prefix and suffix boundaries check `isLowSurrogate` to avoid splitting surrogate pairs at context boundaries.
5. `patch.start1 -= prefixLength` and `patch.start2 -= prefixLength` decrement strictly by `prefix.length`.

### E. Serialization (`stringifyPatch`)
Google DMP patch-text header formatting is maintained (this is not line-based Unified Diff):
- If `length === 0`: `start,0`
- If `length === 1`: `start + 1`
- If `length > 1`: `(start + 1),length`
Example:
```
@@ -21342,32 +21342,51 @@
```
Both `21342` and `32` are 100% UTF-16 code-unit coordinates.

### F. Application (`apply`)
1. `parsed = deepCopy(patches)` ensures input patch objects remain immutable.
2. `nullPadding = addPadding(parsed, margin)` inserts safety boundary tokens.
3. `splitMax(parsed, margin)` subdivides any hunk with `length1 > MAX_BITS` into smaller chunks using code-unit lengths.
4. Patch search and replacement locates chunks using Bitap `match(text, text1, expectedLoc)`.
5. Reconstructed text is spliced using `text.substring(0, startLoc) + text2 + text.substring(startLoc + text1.length)`.
6. No byte offset translations occur anywhere in the execution path.
