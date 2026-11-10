/**
 * SPDX-License-Identifier: Apache-2.0
 * Modified from @sanity/diff-match-patch 3.2.1 by TextDiffNext.
 * Changes: UTF-16 patch coordinates and URI decoding.
 * See THIRD-PARTY-NOTICES.md for upstream attribution.
 */
import {DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT} from '../diff/diff.js'
import {decodeUriText} from '../utils/uriText.js'
import {createPatchObject, type Patch} from './createPatchObject.js'

const patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/

/**
 * Parse a textual representation of patches and return a list of Patch objects.
 *
 * @param textline - Text representation of patches.
 * @returns Array of Patch objects.
 * @public
 */
export function parse(textline: string): Patch[] {
  if (!textline) {
    return []
  }

  const patches: Patch[] = []
  const lines = textline.split('\n')

  let textPointer = 0
  while (textPointer < lines.length) {
    const m = lines[textPointer].match(patchHeader)
    if (!m) {
      throw new Error(`Invalid patch string: ${lines[textPointer]}`)
    }

    const patch = createPatchObject(toInt(m[1]), toInt(m[3]))
    patches.push(patch)
    if (m[2] === '') {
      patch.start1--
      patch.length1 = 1
    } else if (m[2] === '0') {
      patch.length1 = 0
    } else {
      patch.start1--
      patch.length1 = toInt(m[2])
    }

    if (m[4] === '') {
      patch.start2--
      patch.length2 = 1
    } else if (m[4] === '0') {
      patch.length2 = 0
    } else {
      patch.start2--
      patch.length2 = toInt(m[4])
    }
    // Maintain legacy fields
    patch.utf8Start1 = patch.start1
    patch.utf8Start2 = patch.start2
    patch.utf8Length1 = patch.length1
    patch.utf8Length2 = patch.length2

    textPointer++

    while (textPointer < lines.length) {
      const currentLine = lines[textPointer]
      const sign = currentLine.charAt(0)

      if (sign === '@') {
        // Start of next patch
        break
      }

      if (sign === '') {
        // Blank line? Ignore.
        textPointer++
        continue
      }

      let line: string
      try {
        line = decodeUriText(currentLine.slice(1))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (ex) {
        // Malformed URI sequence.
        throw new Error(`Illegal escape in parse: ${currentLine}`)
      }

      if (sign === '-') {
        // Deletion.
        patch.diffs.push([DIFF_DELETE, line])
      } else if (sign === '+') {
        // Insertion.
        patch.diffs.push([DIFF_INSERT, line])
      } else if (sign === ' ') {
        // Minor equality.
        patch.diffs.push([DIFF_EQUAL, line])
      } else {
        // WTF?
        throw new Error(`Invalid patch mode "${sign}" in: ${line}`)
      }
      textPointer++
    }
  }
  return patches
}

function toInt(num: string): number {
  return parseInt(num, 10)
}
