# M3 package and public API contract

## Package layout

`textdiffnext@0.1.0` is prepared for public npm distribution under Apache-2.0, with publication reserved for a separate authorization. `bun run build` emits the same `src/index.ts` API to `dist/index.js` (Node ESM), `dist/index.cjs` (Node CommonJS), and `dist/types/index.d.ts` plus referenced declarations. Package `exports`, `module`, `main`, and `types` point to those files. The tarball's `files` allowlist includes the full `LICENSE`, `THIRD-PARTY-NOTICES.md`, built files and documentation; it has no runtime dependencies. Research and interop libraries are development dependencies. Canonical TextDiffNext repository, homepage, and bugs URLs have not been verified; they must not be populated with Google/Sanity upstream URLs.

The declaration build uses `tsconfig.build.json` with `strict: false` to emit declarations despite the repository's known strict type-check baseline. It does **not** make `bun check --all` clean. The separately run consumer TypeScript check uses `--strict` under `NodeNext` resolution against the installed tarball, for both ESM (`.mts`) and CJS (`.cts`).

## Public entry point

The root specifier `textdiffnext` exports the named API in `src/index.ts`: `makeDiff`, `makePatches`, `applyPatches`, `parsePatch`, `stringifyPatches`, `stringifyPatch`, `match`, `cleanupSemantic`, `cleanupEfficiency`, `xIndex`, the `DIFF_*` constants, and `adjustIndiciesToUcs2`, with their declared option and data types. There is no default export or supported deep-import path. No algorithm or existing function signature changed in M3.

`Patch.start1/start2/length1/length2` are UTF-16 code-unit coordinates. The deprecated `utf8*` aliases mirror those UTF-16 values despite their names. `allowExceedingIndices` on `applyPatches` is accepted but ignored. `adjustIndiciesToUcs2` remains a legacy beta helper and must not be applied to TextDiffNext patches. These are retained for source compatibility through this pre-1.0 milestone. Any removal or semantic reassignment requires an explicit breaking release and a migration note; no silent byte-coordinate conversion will be introduced. See `API-COMPATIBILITY.md`.

## Google DMP compatibility

Two wire profiles are documented in `UNICODE-SERIALIZATION-CONTRACT.md`: standard URI encoding accepted by Google DMP for tested patches, and TextDiffNext `%uXXXX` extension for isolated surrogate code units. Valid Unicode input alone does not guarantee Google compatibility when a diff splits a pair across chunks. Use TextDiffNext parsing for extended patches; test a concrete wire patch with Google before claiming Google interoperability. Literal `%u0000` and `%uD800` in source data encode to `%25u0000` and `%25uD800`, respectively.

## Reproduction gate

Run `bun run test:consumer` from the repository. It builds, dry-run packs, creates a tarball, installs it offline into an isolated consumer, executes ESM and CJS imports with both Bun and Node.js, and type-checks ESM and CJS TypeScript consumers. It cleans up its temporary directory. `bun test` runs the in-repo M1/M2 regression suite. Registry publishing and CI across other runtime/ICU versions have not been performed.
