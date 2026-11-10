# M1 upstream integrity and changed-file inventory

## Identity

- Repository: `https://github.com/sanity-io/diff-match-patch`
- npm package: `@sanity/diff-match-patch@3.2.1`, Apache-2.0
- npm registry `gitHead`: `66ceb54a07a50919d7c9b8693a69dd0ee2fdf7f6`
- Snapshot: `upstream-snapshots/sanity-diff-match-patch/`

## Independent verification

The ledger `upstream-snapshots/SHASUMS256.txt` contains 185 unique paths covering all 185 regular files in the entire `upstream-snapshots/` tree (including the 40 Sanity snapshot files). Recomputed SHA256 values match every entry; no missing, extra, or duplicate paths. The ledger itself is excluded from its own coverage.

Fetched the exact commit archive from GitHub and compared every snapshot file appearing in the commit: all matched byte for byte. Six compiled `dist/` files are package artifacts absent from Git; compared the **entire 40-file snapshot** with the published npm 3.2.1 tarball and found no missing or differing files. The checked-in snapshot was not modified during this audit. This establishes identity with the published package and commit source, while the `dist/` artifacts are tied to the npm tarball rather than the Git tree.

## Complete working-source inventory

A recursive path and content comparison of `src/` against `upstream-snapshots/sanity-diff-match-patch/src/` found **six modified files**, no added paths, no deleted paths, and 24 identical source files:

| Working file | Difference |
| --- | --- |
| `src/patch/apply.ts` | Removes byte-to-UTF-16 adjustment during patch application; retains deprecated option. |
| `src/patch/createPatchObject.ts` | Makes `utf8*` fields optional; populates UTF-16 aliases and documents their units. |
| `src/patch/make.ts` | Uses code-unit lengths for patch coordinates and context; mirrors legacy fields. |
| `src/patch/parse.ts` | Parses header positions as code-unit spans; mirrors legacy fields. |
| `src/patch/splitMax.ts` | Uses code-unit lengths during oversized patch splitting. |
| `src/patch/stringify.ts` | Serializes primary code-unit coordinates rather than byte fields. |

The new audit test file `tests/m1_cross_compatibility.test.ts` and audit reports are project additions outside the copied upstream source. Existing working-tree changes to `benchmarks/correctness-results.json` and `benchmarks/perf-bun.json`, and other untracked documents, predate this audit and were not changed by it. Reproduce the inventory with `diff -qr upstream-snapshots/sanity-diff-match-patch/src src`.
