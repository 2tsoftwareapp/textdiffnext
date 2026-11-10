# TextDiffNext license provenance and public release policy

## Owner decision and scope

The project owner authorized **preparation for public npm distribution under Apache-2.0**, retaining version `0.1.0`. This includes licensing of the package's new contributions under Apache-2.0. It does **not** authorize publication, a public GitHub release, a tag, or upload of release artifacts. The package no longer declares `private: true`, so an accidental publish is possible; release validation must not call `npm publish`.

## Verified upstream chain

1. Google's Diff Match Patch uses the Apache License 2.0. Its preserved `index.js` contains `Copyright 2018 The diff-match-patch Authors.` and `@author fraser@google.com (Neil Fraser)`. The complete license in the official Google repository matches the preserved Sanity `LICENSE` byte for byte (SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`). That exact file is now copied as the root `LICENSE`.[1]
2. Sanity's fork declares `Apache-2.0` in `upstream-snapshots/sanity-diff-match-patch/package.json`. The npm registry identifies `@sanity/diff-match-patch@3.2.1` with `gitHead` `66ceb54a07a50919d7c9b8693a69dd0ee2fdf7f6` and npm tarball SHA-1 `ee1700499bd1242c5e7f3841f93019b6a84388d9`.[4] All **40** preserved Sanity snapshot files match the actual 3.2.1 npm tarball byte for byte; 30 are `src/*.ts`. `AUTHORS` names Google Inc. and Espen Hovlandsdal as TypeScript port contributor, along with authors of other ports.[3]
3. Neither inspected upstream archive contains a file named `NOTICE`. The preserved Google source header and Sanity README/AUTHORS attribution are retained in `THIRD-PARTY-NOTICES.md`. The research snapshots have their own license files; jsdiff is BSD-3-Clause, fast-diff is Apache-2.0. The package does not ship or import those research snapshots.

## Current source lineage

Comparison against the pinned Sanity source **before adding license/modification headers** found 21 byte-identical files, 9 modified files, 2 files at paths absent upstream, and no removed files. The complete path inventory and summaries are in `THIRD-PARTY-NOTICES.md`. The 9 changed files are `diff/diff.ts`, `diff/fromDelta.ts`, `diff/toDelta.ts`, `patch/apply.ts`, `patch/createPatchObject.ts`, `patch/make.ts`, `patch/parse.ts`, `patch/splitMax.ts`, and `patch/stringify.ts`. These now carry conspicuous modification notices. The 2 paths absent upstream are `utils/contextBoundary.ts` and `utils/uriText.ts`; those headers identify the selected package license without inventing a copyright holder. Path comparison alone cannot prove independent authorship.

The source files shipped as bundled ESM/CJS and declarations may not preserve every comment through compilation. Both JavaScript bundles carry an explicit upstream attribution/modification banner; the tarball includes the full license and supplemental notices. The upstream Sanity `src/*.ts` files have no file-level copyright headers to lose. Their project-level README and AUTHORS attributions are represented in the supplemental notices.

## Apache-2.0 redistribution requirements

Apache-2.0 section 4 permits redistribution in source or object form, subject to providing the full license to recipients (4a), prominently identifying changed upstream files (4b), retaining relevant original copyright and attribution notices in distributed source (4c), and carrying over applicable text from an upstream `NOTICE` **if one exists** (4d). Here neither pinned upstream archive has one; this project's `THIRD-PARTY-NOTICES.md` is supplemental and does not claim to be an upstream `NOTICE`. Section 4 also permits additional terms for one's own modifications while maintaining obligations for the underlying Work; the owner has now selected Apache-2.0 for this package.[1]

The root `LICENSE` is the complete official Apache-2.0 text, unchanged, including its appendix template. Any bracketed copyright placeholder inside that standard appendix is a template, **not** a project copyright assignment. No owner or year is invented for TextDiffNext's newly added work.

## Public npm distribution checklist

- `package.json`: `license: "Apache-2.0"`, no `private: true`; conditional ESM/CJS and TypeScript exports retained; `dependencies` absent; existing `devDependencies` retained. The package is unscoped, so `publishConfig.access: "public"` is not required.
- Root `LICENSE`: exact upstream Apache-2.0 terms; tarball includes it.
- `THIRD-PARTY-NOTICES.md`: complete Google/Sanity attribution and source lineage; tarball includes it.
- Modified source: 9 prominent modification headers and SPDX identifiers; newly added source paths carry SPDX identifiers. Upstream copyright holders are not overwritten.
- Build: ESM/CJS bundle banners identify original copyright and upstream fork; type declarations and module exports must match installed consumers.
- **Repository, homepage, and bugs metadata remain unset.** `git remote -v` returned no configured remote and no project-specific canonical URL was verified. The Google/Sanity URLs are upstream projects, not TextDiffNext project URLs; they must not be placed into this package metadata. The owner must supply or verify the canonical project URL and issue tracker before these fields can be added.
- Packaging, tests and CI evidence are recorded in `M3-FINAL-AUDIT.md`. No registry upload was attempted.
