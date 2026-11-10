/** SPDX-License-Identifier: Apache-2.0 */
import {isHighSurrogate, isLowSurrogate} from './surrogatePairs.js'

/** Encode like encodeURI, extending it only for unpaired UTF-16 surrogates. */
export function encodeUriText(text: string): string {
  let encoded = ''
  let chunkStart = 0
  for (let index = 0; index < text.length; index++) {
    const char = text.charAt(index)
    const unpairedHigh = isHighSurrogate(char) && !isLowSurrogate(text.charAt(index + 1))
    const unpairedLow = isLowSurrogate(char) && !isHighSurrogate(text.charAt(index - 1))
    if (unpairedHigh || unpairedLow) {
      encoded += encodeURI(text.slice(chunkStart, index))
      encoded += `%u${text.charCodeAt(index).toString(16).toUpperCase().padStart(4, '0')}`
      chunkStart = index + 1
    }
  }
  return encoded + encodeURI(text.slice(chunkStart))
}

/** Decode Google DMP URI text and TextDiffNext's %uXXXX extension. */
export function decodeUriText(text: string): string {
  let decoded = ''
  let chunkStart = 0
  const loneSurrogate = /%u([dD][89a-fA-F][0-9a-fA-F]{2})/g
  for (const match of text.matchAll(loneSurrogate)) {
    const index = match.index
    decoded += decodeURI(text.slice(chunkStart, index))
    decoded += String.fromCharCode(parseInt(match[1]!, 16))
    chunkStart = index + match[0].length
  }
  return decoded + decodeURI(text.slice(chunkStart))
}
