const RATIOS = [1, 1.25, 1.33] // cover height / width: square, 4:5, 3:4

/** A stable cover shape per id, so the feed looks staggered but doesn't jump around. */
export function coverRatio(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return RATIOS[h % RATIOS.length]!
}
