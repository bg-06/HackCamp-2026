// Cover height / width. Real photos get tall covers like a photo feed; without a photo the cover is
// just a colour and an icon, so it stays short instead of being a big empty block.
const PHOTO_RATIOS = [1, 1.25, 1.33] // square, 4:5, 3:4
const PLAIN_RATIOS = [0.5, 0.62, 0.75]

// Same shape for the same id every time, so the feed doesn't jump around
export function coverRatio(id: string, hasPhoto = false) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const ratios = hasPhoto ? PHOTO_RATIOS : PLAIN_RATIOS
  return ratios[h % ratios.length]!
}

// "Illegal Dumping Case" -> "Illegal dumping", for the middle of a sentence. Keeps acronyms like "BC".
export function requestTypeInSentence(requestType: string) {
  return requestType
    .replace(/ Case$/, '')
    .split(' ')
    .map((w, i) => (i === 0 || (w.length > 1 && w === w.toUpperCase()) ? w : w.toLowerCase()))
    .join(' ')
}
