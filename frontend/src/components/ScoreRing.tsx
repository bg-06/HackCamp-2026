interface Props {
  value: string | number
  title: string
  sub: string
  badge?: number // small count on the ring's corner
  tone?: 'normal' | 'warn'
}

// A number in a ring with a two-line caption next to it.
export default function ScoreRing({ value, title, sub, badge, tone = 'normal' }: Props) {
  return (
    <div className={`score ${tone}`}>
      <span className="score-ring">
        {value}
        {badge !== undefined && <span className="score-badge">{badge}</span>}
      </span>
      <span className="score-text">
        <span className="score-title">{title}</span>
        <span className="score-sub">{sub}</span>
      </span>
    </div>
  )
}
