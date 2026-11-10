/** SPDX-License-Identifier: Apache-2.0 */
import {isHighSurrogate, isLowSurrogate} from './surrogatePairs.js'

/** Expand an outer context boundary without changing the UTF-16 offset system. */
export function contextBoundary(
  text: string,
  offset: number,
  side: 'start' | 'end',
  segmenter: Intl.Segmenter | null,
): number {
  const candidate = Math.max(0, Math.min(text.length, offset))
  if (segmenter) {
    let previous = 0
    for (const {index, segment} of segmenter.segment(text)) {
      if (candidate === index || candidate === index + segment.length) return candidate
      if (candidate < index + segment.length) {
        return side === 'start' ? index : index + segment.length
      }
      previous = index + segment.length
    }
    return previous
  }
  // Without Intl.Segmenter, preserve code points, including surrogate pairs.
  if (isHighSurrogate(text.charAt(candidate - 1)) && isLowSurrogate(text.charAt(candidate))) {
    return side === 'start' ? candidate - 1 : candidate + 1
  }
  return candidate
}
