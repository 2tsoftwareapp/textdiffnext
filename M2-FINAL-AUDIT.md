# TextDiffNext — M2 Final Audit & Closure Gate Report

## Verdict: M2 Unicode Hardening — conditionally accepted

The user accepted the Unicode Hardening scope of M2. Packaging remains an explicit M3 blocker. Evidence is limited to the cases and runs below; a finite test suite does not prove every possible UTF-16 string.

1. No silent corruption reproduced after fixing two concrete diff defects in the audited regression and seeded fuzz cases.
2. The codec round-tripped every individual UTF-16 code unit and the tested mixed strings, including lone surrogates and astral characters.
3. Google DMP compatibility boundaries are specified in `UNICODE-SERIALIZATION-CONTRACT.md`.
4. Tested grapheme context expansions maintained exact UTF-16 patch coordinates and reconstruction.
5. Newly authored files had zero type diagnostics in the recorded type-check run. Diagnostics in modified files cannot be assigned to M1 or M2 without a full baseline.
6. The full suite passed at audit time; see the command results below.

**M3 packaging blocker:** `package.json` lacks `version`, so `bun pm pack --dry-run --ignore-scripts` exits 1. Its `module` points at root `index.ts`, which prints `Hello via Bun!` and exports nothing; this was reproduced by importing that file. Building `src/index.ts` only verifies the source bundle, not consumer resolution or package installation. M3 must test the package entry point, ESM/CJS consumers, declarations, dry-run packing and installation independently.

---

## Audit 1 — URI serialization protocol (`src/utils/uriText.ts`)

- **Adversarial coverage (`tests/m2_final_audit.test.ts`):**
  - Literal `%u0000` and `%uD800` were also tested end to end as ordinary input text through patch and delta wire formats: both emit `%25u...` and reconstruct exactly.
  - Lone high surrogates (`\uD800`) encode to `%uD800`; lone low surrogates (`\uDC00`) encode to `%uDC00`. Both round-trip exactly.
  - All 65,536 individual UTF-16 code units (0x0000–0xFFFF) round-trip identically through `decodeUriText(encodeUriText(x))`.
  - Astral characters (`🚀`, `🌍`) use standard percent-encoded UTF-8 and round-trip through both TextDiffNext and upstream Google DMP (`diff-match-patch`).
  - Malformed/incomplete sequences (`%`, `%u`, `%uD8`, `%uD80`, `%uD80X`, `%u0000`, `%GG`, `%E0%A4%A`) throw `URIError` / `Illegal escape in parse` deterministically.
  - Plain text decode cannot silently reinterpret user data: decode is strictly intended for wire format.
  - TextDiffNext extension status is explicitly documented in `UNICODE-SERIALIZATION-CONTRACT.md`.

---

## Audit 2 — Grapheme context integrity (`src/utils/contextBoundary.ts`, `src/patch/make.ts`)

- **Verification:**
  - Context expansion adjusts slice bounds in UTF-16 code units while keeping `start1/start2/length1/length2` aligned with actual diff contents.
  - Separated adjacent edits maintain valid non-overlapping hunks:
    `patches[0].start1 + patches[0].length1 <= patches[1].start1`.
  - Both `Intl.Segmenter` and fallback mode (`graphemeSegmenter: null`) preserve surrogate pairs and produce exact reconstruction.
  - Patch reconstruction verified by applying parsed patches directly as well as sequential hunk application: both assert `rolling === after`.

---

## Audit 3 — Surrogate cleanup (`src/diff/diff.ts`)

- **Defects discovered and resolved during audit:**
  1. *Shared low surrogate defect (`deisolateChar`):* When deleting a high surrogate while the following low surrogate is shared (`0𐀀` -> `0\uDC00`), `deisolateChar` previously inserted the missing low surrogate at `j = i - 1` (or `-1`), causing `Array.splice` to place it at the wrong position.
     - **Fix:** Clamped splice position to `j = dir === 1 ? i + 1 : i`, placing the edit adjacent to the moved equality.
  2. *Surrogate half insertion defect (`adjustDiffForSurrogatePairs`):* When an edit occurred between surrogate halves (`\uD800\uDC00` -> `\uD800G\uDC00`), chunk boundary checks tested inverted string offsets (`diffs[i][1][0]` instead of the chunk tail).
     - **Fix:** Corrected character comparison direction based on scan direction `dir`.
- **Invariants confirmed:**
  - Ordinary ASCII and BMP diffs are completely unchanged (`toEqual(doDiff(...))`).
  - CJK, combining characters, and adjacent ASCII are preserved without corruption.

---

## Audit 4 — Type-check baseline (`bun check --all`)

See detailed report in `M2-TYPECHECK-BASELINE.md`.
- Total diagnostics: 1,154 in 51 files (exit code 1).
- Newly authored files (`src/utils/uriText.ts`, `src/utils/contextBoundary.ts`, `tests/m2_unicode_hardening.test.ts`, `tests/m2_final_audit.test.ts`, `tests/m2_fuzz.test.ts`): **0 diagnostics**.
- Modified files contain 52 diagnostics. With no complete M1 diagnostic snapshot, the number introduced by M2 within those files is unknown; their presence cannot be attributed to either upstream or M2 from aggregate counts.

---

## Audit 5 — Final verification test suite

### Executed commands and results

| Test Suite | Command | Exit Code | Tests | Assertions | Status |
| --- | --- | ---: | ---: | ---: | --- |
| Milestone 1 regression & cross-compat | `bun test tests/milestone1_regression.test.ts tests/m1_cross_compatibility.test.ts` | 0 | 19 | 102 | PASS |
| M2 Unicode hardening | `bun test tests/m2_unicode_hardening.test.ts` | 0 | 14 | 205 | PASS |
| M2 Final adversarial audit | `bun test tests/m2_final_audit.test.ts` | 0 | 9 | 182 | PASS |
| M2 Deterministic fuzz probe (1,600 iterations, seed 0x4d325f41) | `bun test tests/m2_fuzz.test.ts` | 0 | 1 | 49,595 | PASS |
| **Combined full suite** | `bun test` | **0** | **43** | **50,084** | **PASS** |
| Production build check | `bun build src/index.ts --target=bun --outdir /tmp/...` | 0 | 30 modules | 52.97 KB | PASS |

### Changed file inventory

- **Modified:**
  - `src/diff/diff.ts` (fixed `deisolateChar` and `adjustDiffForSurrogatePairs` direction bugs)
  - `M2-VERIFICATION.md` (corrected unproven baseline claim)
- **Added:**
  - `UNICODE-SERIALIZATION-CONTRACT.md` (contract and boundaries)
  - `M2-TYPECHECK-BASELINE.md` (typecheck analysis)
  - `M2-FINAL-AUDIT.md` (this report)
  - `tests/m2_final_audit.test.ts` (adversarial URI, context, surrogate tests)
  - `tests/m2_fuzz.test.ts` (deterministic seed 0x4d325f41 fuzz suite)
  - (In `tests/m2_unicode_hardening.test.ts`: added regression test cases for the 2 reproduced defects)
