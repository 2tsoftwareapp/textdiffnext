/**
 * SPDX-License-Identifier: Apache-2.0
 * Modified from @sanity/diff-match-patch 3.2.1 by TextDiffNext.
 * Changes: UTF-16 patch coordinates and grapheme-safe context.
 * See THIRD-PARTY-NOTICES.md for upstream attribution.
 */
import {cleanupEfficiency, cleanupSemantic} from '../diff/cleanup.js'
import {diff, DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT, type Diff} from '../diff/diff.js'
import {diffText1} from '../diff/diffText.js'
import {contextBoundary} from '../utils/contextBoundary.js'
import {DEFAULT_MARGIN, MAX_BITS} from './constants.js'
import {createPatchObject, type Patch} from './createPatchObject.js'

/**
 * Options for patch generation.
 *
 * @public
 */
export interface MakePatchOptions {
  // Chunk size for context length.
  margin: number
  /** Optional grapheme capability. null uses the code-point fallback. */
  graphemeSegmenter?: Intl.Segmenter | null
}

const DEFAULT_OPTS: MakePatchOptions = {
  margin: 4,
  graphemeSegmenter:
    typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, {granularity: 'grapheme'}) : null,
}

function getDefaultOpts(opts: Partial<MakePatchOptions> = {}): MakePatchOptions {
  return {
    ...DEFAULT_OPTS,
    ...opts,
  }
}

/**
 * Compute a list of patches to turn based on passed diffs.
 *
 * @param diffs - Array of diff tuples.
 * @param options - Options for the patch generation.
 * @returns Array of Patch objects.
 * @public
 */
export function make(diffs: Diff[], options?: Partial<MakePatchOptions>): Patch[]

/**
 * Compute a list of patches to turn textA into textB.
 *
 * @param textA - Original text.
 * @param textB - New text.
 * @param options - Options for the patch generation.
 * @returns Array of Patch objects.
 * @public
 */
export function make(textA: string, textB: string, options?: Partial<MakePatchOptions>): Patch[]

/**
 * Compute a list of patches to turn textA into textB using provided diff tuples.
 *
 * @param textA - Original text.
 * @param diffs - Diff tuples to use as base.
 * @param options - Options for the patch generation.
 * @returns Array of Patch objects.
 * @public
 */
export function make(textA: string, diffs: Diff[], options?: Partial<MakePatchOptions>): Patch[]

export function make(
  a: Diff[] | string,
  b?: Partial<MakePatchOptions> | string | Diff[],
  options?: Partial<MakePatchOptions>,
): Patch[] {
  if (typeof a === 'string' && typeof b === 'string') {
    // Method 1: textA, textB
    // Compute diffs from textA and textB.
    let diffs = diff(a, b, {checkLines: true})
    if (diffs.length > 2) {
      diffs = cleanupSemantic(diffs)
      diffs = cleanupEfficiency(diffs)
    }
    return _make(a, diffs, getDefaultOpts(options))
  }

  if (a && Array.isArray(a) && typeof b === 'undefined') {
    // Method 2: diffs
    // Compute textA from diffs.
    return _make(diffText1(a), a, getDefaultOpts(options))
  }

  if (typeof a === 'string' && b && Array.isArray(b)) {
    // Method 3: textA, diffs
    return _make(a, b, getDefaultOpts(options))
  }

  throw new Error('Unknown call format to make()')
}

function _make(textA: string, diffs: Diff[], options: MakePatchOptions): Patch[] {
  if (diffs.length === 0) {
    return [] // Get rid of the null case.
  }
  const patches: Patch[] = []

  let patch = createPatchObject(0, 0)
  let patchDiffLength = 0 // Keeping our own length var is faster in JS.
  let charCount1 = 0 // Number of characters into the textA string.
  let charCount2 = 0 // Number of characters into the textB string.

  // Start with textA (prepatchText) and apply the diffs until we arrive at
  // textB (postpatchText).  We recreate the patches one by one to determine
  // context info.
  let prepatchText = textA
  let postpatchText = textA

  for (let x = 0; x < diffs.length; x++) {
    const currentDiff = diffs[x]
    const [diffType, diffText] = currentDiff
    const diffTextLength = diffText.length

    if (!patchDiffLength && diffType !== DIFF_EQUAL) {
      // A new patch starts here.
      patch.start1 = charCount1
      patch.start2 = charCount2
      patch.utf8Start1 = charCount1
      patch.utf8Start2 = charCount2
    }

    switch (diffType) {
      case DIFF_INSERT:
        patch.diffs[patchDiffLength++] = currentDiff
        patch.length2 += diffTextLength
        postpatchText =
          postpatchText.substring(0, charCount2) + diffText + postpatchText.substring(charCount2)
        break
      case DIFF_DELETE:
        patch.length1 += diffTextLength
        patch.diffs[patchDiffLength++] = currentDiff
        postpatchText =
          postpatchText.substring(0, charCount2) +
          postpatchText.substring(charCount2 + diffTextLength)
        break
      case DIFF_EQUAL:
        if (diffTextLength <= 2 * options.margin && patchDiffLength && diffs.length !== x + 1) {
          // Small equality inside a patch.
          patch.diffs[patchDiffLength++] = currentDiff
          patch.length1 += diffTextLength
          patch.length2 += diffTextLength
        } else if (diffTextLength >= 2 * options.margin) {
          // Time for a new patch.
          if (patchDiffLength) {
            addContext(patch, prepatchText, options)
            patches.push(patch)
            patch = createPatchObject(-1, -1)
            patchDiffLength = 0
            // Unlike Unidiff, our patch lists have a rolling context.
            // http://code.google.com/p/google-diff-match-patch/wiki/Unidiff
            // Update prepatch text & pos to reflect the application of the
            // just completed patch.
            prepatchText = postpatchText
            charCount1 = charCount2
          }
        }
        break
      default:
        throw new Error('Unknown diff type')
    }

    // Update the current character count.
    if (diffType !== DIFF_INSERT) {
      charCount1 += diffTextLength
    }
    if (diffType !== DIFF_DELETE) {
      charCount2 += diffTextLength
    }
  }

  // Pick up the leftover patch if not empty.
  if (patchDiffLength) {
    addContext(patch, prepatchText, options)
    patches.push(patch)
  }

  // Sync legacy utf8 fields to mirror start/length
  for (let i = 0; i < patches.length; i++) {
    const p = patches[i]
    p.utf8Start1 = p.start1
    p.utf8Start2 = p.start2
    p.utf8Length1 = p.length1
    p.utf8Length2 = p.length2
  }

  return patches
}

/**
 * Increase the context until it is unique,
 * but don't let the pattern expand beyond MAX_BITS.
 *
 * @param patch - The patch to grow.
 * @param text - Source text.
 * @param opts
 * @internal
 */
export function addContext(patch: Patch, text: string, opts: MakePatchOptions): void {
  if (text.length === 0) {
    return
  }
  let pattern = text.substring(patch.start2, patch.start2 + patch.length1)
  let padding = 0

  // Look for the first and last matches of pattern in text.  If two different
  // matches are found, increase the pattern length.
  while (
    text.indexOf(pattern) !== text.lastIndexOf(pattern) &&
    pattern.length < MAX_BITS - opts.margin - opts.margin
  ) {
    padding += opts.margin
    pattern = text.substring(patch.start2 - padding, patch.start2 + patch.length1 + padding)
  }
  // Add one chunk for good luck.
  padding += opts.margin

  // Add the prefix.

  // Expand only outer context edges; the edit's own boundaries are unchanged.
  const prefixStart = contextBoundary(text, patch.start2 - padding, 'start', opts.graphemeSegmenter ?? null)

  const prefix = text.substring(prefixStart, patch.start2)
  if (prefix) {
    patch.diffs.unshift([DIFF_EQUAL, prefix])
  }

  const prefixLength = prefix.length

  // Add the suffix.

  const suffixEnd = contextBoundary(
    text,
    patch.start2 + patch.length1 + padding,
    'end',
    opts.graphemeSegmenter ?? null,
  )

  const suffix = text.substring(patch.start2 + patch.length1, suffixEnd)
  if (suffix) {
    patch.diffs.push([DIFF_EQUAL, suffix])
  }

  const suffixLength = suffix.length

  // Roll back the start points.
  patch.start1 -= prefixLength
  patch.start2 -= prefixLength

  // Extend the lengths.
  patch.length1 += prefixLength + suffixLength
  patch.length2 += prefixLength + suffixLength

  patch.utf8Start1 = patch.start1
  patch.utf8Start2 = patch.start2
  patch.utf8Length1 = patch.length1
  patch.utf8Length2 = patch.length2
}
