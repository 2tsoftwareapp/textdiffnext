# M2 type-check baseline audit

## Repository totals

| Source | Command | Diagnostics | Files with errors | Checked files | Exit code |
| --- | --- | ---: | ---: | ---: | ---: |
| M1 audit baseline (`M1-FINAL-AUDIT.md:20`) | `bun check` | 1,155 | 50 | 123 | Non-zero |
| M2 pre-audit report (`M2-VERIFICATION.md:56`) | `bun check --all` | 1,155 | 52 | 127 | 1 |
| M2 final audit | `bun check --all` | 1,154 | 51 | 127 | 1 |

Directory breakdown in current audit:

| Directory | Diagnostics |
| --- | ---: |
| `corpus/` | 651 |
| `src/` | 243 |
| `upstream-snapshots/` | 220 |
| `tests/` | 26 |
| `benchmarks/` | 14 |
| **Total** | **1,154** |

## Audit of the 243 `src/` diagnostics

The 243 `src/` diagnostics are distributed across modified and untouched source files:

| File | Diagnostics | Touched in M2 |
| --- | ---: | --- |
| `src/diff/diff.ts` | 27 | Yes |
| `src/diff/fromDelta.ts` | 3 | Yes |
| `src/diff/toDelta.ts` | 1 | Yes |
| `src/patch/make.ts` | 12 | Yes |
| `src/patch/parse.ts` | 7 | Yes |
| `src/patch/stringify.ts` | 2 | Yes |
| Untouched `src/` files (cleanup, halfMatch, match, bisect, etc.) | 191 | No |
| **Total `src/` diagnostics** | **243** | |

### Evidence evaluation

- **Newly authored files:**
  - `src/utils/uriText.ts`: **0 diagnostics**
  - `src/utils/contextBoundary.ts`: **0 diagnostics**
  - `tests/m2_unicode_hardening.test.ts`: **0 diagnostics**
  - `tests/m2_final_audit.test.ts`: **0 diagnostics**
  - `tests/m2_fuzz.test.ts`: **0 diagnostics**
- **Modified existing files:** The six modified files contain 52 diagnostics. Their types include `TS2532` and `TS2488`, which are consistent with strict index checking, but without a complete diagnostic snapshot from M1 we cannot distinguish inherited diagnostics from ones introduced during M2. No per-diagnostic before/after claim is supported by the aggregate totals.
- **Can the 243 `src/` diagnostics be proven pre-existing?**
  - **Verdict:** **Inconclusive / unprovable without an exact M1 source AST / diagnostic dump.**
  - **Reason:** The M1 workspace was untracked (`src/` was never committed to Git at M1 closure, and no filesystem snapshot exists). Only aggregate numbers (1,155 errors across 50 files) were recorded in `M1-FINAL-AUDIT.md`.
  - While newly authored files have 0 diagnostics and the repository-wide total moved from 1,155 to 1,154, we strictly refrain from labeling the 243 `src/` diagnostics as definitively inherited from upstream without an exact file-by-file M1 baseline snapshot.
