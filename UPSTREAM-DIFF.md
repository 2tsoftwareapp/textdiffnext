# TextDiffNext — Upstream Diff Specification

## Overview
This document records all modifications made to `@sanity/diff-match-patch` (version `3.2.1`, commit `66ceb54a07a50919d7c9b8693a69dd0ee2fdf7f6`) to produce TextDiffNext Milestone 1.

All changes are strictly focused on **Index Restoration** (restoring UTF-16 code-unit contract and eliminating the silent corruption flaw).

---

## Working-source diff summary

### 1. `src/patch/createPatchObject.ts`
- Made `utf8Start1`, `utf8Start2`, `utf8Length1`, and `utf8Length2` optional/deprecated properties on the `Patch` interface.
- Preserved legacy fields in `createPatchObject()` initialized to UTF-16 equivalents for backwards compatibility.

```diff
--- upstream-snapshots/sanity-diff-match-patch/src/patch/createPatchObject.ts
+++ src/patch/createPatchObject.ts
@@ -10,8 +10,10 @@
   start1: number
   start2: number
-  utf8Start1: number
-  utf8Start2: number
   length1: number
   length2: number
+  utf8Start1?: number
+  utf8Start2?: number
   utf8Length1?: number
   utf8Length2?: number
 }
```

### 2. `src/patch/make.ts`
- Removed `countUtf8Bytes` import and usage.
- Removed UTF-8 byte tracking counters (`utf8Count1`, `utf8Count2`, `diffByteLength`, `prefixUtf8Length`, `suffixUtf8Length`).
- Coordinates in patch generation now directly reflect `diffText.length`.

```diff
--- upstream-snapshots/sanity-diff-match-patch/src/patch/make.ts
+++ src/patch/make.ts
@@ -5,1 +5,0 @@
-import {countUtf8Bytes} from '../utils/utf8Indices.js'
@@ -101,2 +100,0 @@
-  let utf8Count1 = 0
-  let utf8Count2 = 0
@@ -115,1 +112,0 @@
-    const diffByteLength = countUtf8Bytes(diffText)
@@ -120,2 +116,2 @@
-      patch.utf8Start1 = utf8Count1
-      patch.utf8Start2 = utf8Count2
+      patch.utf8Start1 = charCount1
+      patch.utf8Start2 = charCount2
@@ -127,1 +123,0 @@
-        patch.utf8Length2 += diffByteLength
@@ -134,1 +129,0 @@
-        patch.utf8Length1 += diffByteLength
@@ -147,2 +141,0 @@
-          patch.utf8Length1 += diffByteLength
-          patch.utf8Length2 += diffByteLength
```

### 3. `src/patch/stringify.ts`
- Formats Google DMP patch-text coordinates from `patch.start1`, `patch.start2`, `patch.length1`, `patch.length2` instead of `utf8Start` and `utf8Length`.

```diff
--- upstream-snapshots/sanity-diff-match-patch/src/patch/stringify.ts
+++ src/patch/stringify.ts
@@ -20,1 +20,1 @@
-  const {utf8Length1, utf8Length2, utf8Start1, utf8Start2, diffs} = patch
+  const {length1, length2, start1, start2, diffs} = patch
```

### 4. `src/patch/parse.ts`
- Removed `countUtf8Bytes` import and UTF-8 byte difference subtraction logic (`utf8Diff = countUtf8Bytes(line) - line.length`).
- Populates `length1` and `length2` directly from parsed header numbers.

```diff
--- upstream-snapshots/sanity-diff-match-patch/src/patch/parse.ts
+++ src/patch/parse.ts
@@ -2,1 +1,0 @@
-import {countUtf8Bytes} from '../utils/utf8Indices.js'
@@ -33,2 +31,0 @@
-      patch.utf8Start1--
-      patch.utf8Length1 = 1
@@ -40,3 +36,1 @@
-      // The patch itself will contain the UTF-8 length
-      patch.utf8Length1 = toInt(m[2])
-      // We start with UCS-2 length set to the same, but we adjust for it later
-      patch.length1 = patch.utf8Length1
+      patch.length1 = toInt(m[2])
@@ -90,4 +78,0 @@
-      // The number of bytes in a line does not equate to the number of "characters"
-      // returned by `string.length` - we have to subtract the diff here in order to
-      // make slicing/calculations work correctly
-      const utf8Diff = countUtf8Bytes(line) - line.length
```

### 5. `src/patch/splitMax.ts`
- Removed `countUtf8Bytes` from patch splitting calculations.

### 6. `src/patch/apply.ts`
- Removed invocation of `adjustIndiciesToUcs2(patches, text)`.
- Replaced with `deepCopy(patches)`.
- Preserved signature of `ApplyPatchOptions` with `allowExceedingIndices?: boolean`.

```diff
--- upstream-snapshots/sanity-diff-match-patch/src/patch/apply.ts
+++ src/patch/apply.ts
@@ -9,1 +8,0 @@
-import {adjustIndiciesToUcs2} from '../utils/utf8Indices.js'
@@ -12,1 +11,1 @@
-import {type Patch} from './createPatchObject.js'
+import {deepCopy, type Patch} from './createPatchObject.js'
@@ -76,3 +70,2 @@
-  // Note: adjustment also deep-copies patches so that no changes are made to the originals.
-  const parsed = adjustIndiciesToUcs2(patches, text, {
-    allowExceedingIndices: opts.allowExceedingIndices,
-  })
+  // Deep-copy patches so that no changes are made to the originals.
+  const parsed = deepCopy(patches)
```
