import type { ReactNode } from 'react'

export interface MasonryItem {
  key: string
  ratio: number // cover height / width, used to guess how tall the card is
  node: ReactNode
}

// Two columns like a photo feed. Each card goes into whichever column is shorter so far,
// so the reading order stays close to the sort order (left, right, left, right...).
export default function MasonryFeed({ items, label }: { items: MasonryItem[]; label: string }) {
  const cols: [MasonryItem[], MasonryItem[]] = [[], []]
  const heights = [0, 0]
  for (const item of items) {
    const i = heights[0]! <= heights[1]! ? 0 : 1
    cols[i].push(item)
    heights[i]! += item.ratio + 0.6 // 0.6 ≈ the text under the cover, in card widths
  }
  return (
    <div className="masonry" role="list" aria-label={label}>
      {cols.map((col, i) => (
        <div key={i} className="masonry-col">
          {col.map((item) => (
            <div key={item.key} role="listitem">
              {item.node}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
