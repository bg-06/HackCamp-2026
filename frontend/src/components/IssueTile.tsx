import { Link } from 'react-router-dom'
import { categoryStyle } from '../data/categories'
import { formatKm } from '../lib/geo'
import type { Track2Issue, Vote } from '../types'
import VoteControl from './VoteControl'

interface Props {
  issue: Track2Issue
  rank: number // position in the current sort
  ratio: number
  distanceKm?: number
  onVote: (id: string, value: Vote) => void
}

/** A City-only issue in the feed. Tap the card to open it; vote right here. */
export default function IssueTile({ issue, rank, ratio, distanceKm, onVote }: Props) {
  const Icon = categoryStyle(issue.category).icon
  const title = issue.request_type.replace(/ Case$/, '')
  const openFor = `${issue.days_open} ${issue.days_open === 1 ? 'day' : 'days'}`
  const meta = distanceKm !== undefined ? formatKm(distanceKm) : null

  return (
    <article className="tile issue-tile">
      <Link className="tile-link" to={`/issues/${encodeURIComponent(issue.issue_id)}`}>
        <div className="tile-cover" style={{ aspectRatio: `1 / ${ratio}` }}>
          <Icon size={32} strokeWidth={1.5} aria-hidden="true" />
          <span className="tile-tag">{openFor}</span>
        </div>
        <div className="tile-body">
          <p className="eyebrow">#{rank}</p>
          <h3>{title}</h3>
          <p className="tile-meta">{issue.address ?? issue.local_area}</p>
          {meta && <p className="tile-meta">{meta}</p>}
        </div>
      </Link>
      <div className="tile-vote">
        <VoteControl issue={issue} onVote={onVote} compact />
      </div>
    </article>
  )
}
