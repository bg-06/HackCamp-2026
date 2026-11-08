import { ChevronDown, ChevronUp } from 'lucide-react'
import { categoryStyle } from '../data/categories'
import { formatKm } from '../lib/geo'
import { issueScore } from '../lib/issues'
import type { Track2Issue, Vote } from '../types'

interface Props {
  issue: Track2Issue
  rank: number // position in the current sort
  ratio: number
  distanceKm?: number
  onVote: (id: string, value: Vote) => void
}

/** A photo-first card for a City-only issue, with the vote right on it. */
export default function IssueTile({ issue, rank, ratio, distanceKm, onVote }: Props) {
  const Icon = categoryStyle(issue.category).icon
  const { up, down, score } = issueScore(issue)
  const title = issue.request_type.replace(/ Case$/, '')
  const vote = (value: 1 | -1) => onVote(issue.issue_id, issue.my_vote === value ? 0 : value) // tap again to clear

  return (
    <article className="tile issue-tile">
      <div className="tile-cover" style={{ aspectRatio: `1 / ${ratio}` }}>
        <Icon size={56} strokeWidth={1.4} aria-hidden="true" />
        <span className="tile-rank">#{rank}</span>
        <span className={`tile-pill left ${issue.days_open >= 14 ? 'overdue' : ''}`}>
          Open {issue.days_open} {issue.days_open === 1 ? 'day' : 'days'}
        </span>
        {distanceKm !== undefined && <span className="tile-pill">{formatKm(distanceKm)}</span>}
      </div>

      <div className="tile-body">
        <h3>{title}</h3>
        <p className="tile-place">{issue.address ?? issue.local_area}</p>
        <div className="tile-vote" role="group" aria-label={`Vote on ${title}`}>
          <button
            className={`vote-button up ${issue.my_vote === 1 ? 'on' : ''}`}
            aria-pressed={issue.my_vote === 1}
            aria-label={`Pressing (${up})`}
            title="This affects me, it's pressing"
            onClick={() => vote(1)}
          >
            <ChevronUp size={20} aria-hidden="true" />
          </button>
          <span className="vote-score" aria-label={`Score ${Math.round(score)}`}>
            {Math.round(score)}
          </span>
          <button
            className={`vote-button down ${issue.my_vote === -1 ? 'on' : ''}`}
            aria-pressed={issue.my_vote === -1}
            aria-label={`Not a problem (${down})`}
            title="Not a problem, already fixed, or not urgent"
            onClick={() => vote(-1)}
          >
            <ChevronDown size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}
