# TextDiffNext M1 final audit and closure gate

**Verdict: COMPLETE for the six requested M1 closure conditions.** This verdict covers patch format, API semantics, cross-engine tests, snapshot integrity, and the Bun regression suite. It does not assert a clean repository-wide TypeScript check or universal interoperability for all Unicode edits.

## Findings and actions

| Gate | Evidence | Result |
| --- | --- | --- |
| F-01 patch text | `src/patch/stringify.ts` and `parse.ts` implement Google DMP character-oriented patch text: operation lines are URI-escaped and header positions count UTF-16 code units. It is not standard Unified Diff. Corrected `OFFSET-CONTRACT.md` and `UPSTREAM-DIFF.md`; documented coordinate exceptions for zero-length spans in `API-COMPATIBILITY.md`. | Met |
| F-02 legacy fields | Sanity exported byte-valued `utf8*` properties. The fork emits optional **UTF-16 aliases** with those names. Added explicit deprecation JSDoc and tested the actual values following an emoji. Documented the byte-coordinate migration break and the still-exported beta conversion helper. | Met, with migration risk |
| F-03 Google interop | New bidirectional serialized patch tests for Vietnamese, astral emoji context, CJK, combining marks, CRLF, multiple Unicode hunks, and URI special characters assert exact output and hunk flags. Separate emoji substitution test documents Google serializer failure and demonstrates Google applying the fork's text. | Met for tested inputs |
| F-04 option | Inspected old helper's partial-code-point behavior and EOF handling; inventoried upstream `apply` call and remaining public beta helper consumer. `allowExceedingIndices` is a deprecated no-op in fork application and should be removed only in a future breaking release. | Met |
| F-05 provenance | 185/185 ledger entries match every regular snapshot file, with no missing, extra, or duplicate paths. All 40 Sanity snapshot files equal npm 3.2.1 tarball contents; all Git-archive-present files equal commit `66ceb54a07a50919d7c9b8693a69dd0ee2fdf7f6`. Six `dist/` files exist only in the npm artifact. Six changed source files, zero added/deleted source paths. | Met |
| Tests | `bun test`: **19 pass, 0 fail, 102 assertions**, two test files, Bun 1.4.4. | Met |

## Remaining risks for M2

1. The `utf8*` names imply byte coordinates while holding UTF-16 aliases. Byte-coordinate Sanity clients require explicit migration or an adapter; the exported `adjustIndiciesToUcs2` must not be applied to fork patches.
2. Interoperability of arbitrary changed astral symbols is not universal: Google throws when its diff creates a lone surrogate; the Unicode-heavy corpus's serialized roundtrip was not proved by these focused tests.
3. `bun check` fails repository-wide with 1,155 diagnostics in 50 files, including copied upstream code and corpus fixture files. The M1 tests pass, but the project has no clean type-check gate. The audit did not rework the broader TypeScript configuration.
4. Previous performance and all-corpus claims in `BENCHMARK-RESULTS.md` / `IMPLEMENTATION-LOG.md` go beyond the evidence established by this final audit. Do not treat the claimed speedup or universal serialization success as a closure-gate result without a fresh, reproducible run and per-scenario results.

## Reproduction

- `bun test`
- `diff -qr upstream-snapshots/sanity-diff-match-patch/src src`
- Recompute each hash from `upstream-snapshots/SHASUMS256.txt` and compare the path set with the files under `upstream-snapshots/`; published tarball and exact commit comparisons require network access.
