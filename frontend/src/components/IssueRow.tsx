import { MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categoryStyle } from '../data/categories'
import { formatKm } from '../lib/geo'
import type { Track2Issue, Vote } from '../types'
import VoteControl from './VoteControl'

interface Props {
  issue: Track2Issue
  rank: number
  distanceKm?: number
  onVote: (id: string, value: Vote) => void
}

export default function IssueRow({ issue, rank, distanceKm, onVote }: Props) {
  const style = categoryStyle(issue.category)
  const meta = [`Open ${issue.days_open} ${issue.days_open === 1 ? 'day' : 'days'}`, distanceKm !== undefined ? formatKm(distanceKm) : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="issue-row">
      <Link className="issue-row-main" to={`/issues/${encodeURIComponent(issue.issue_id)}`}>
        <span className="issue-rank">{rank}</span>
        {/* Same size with or without a photo, so the rows line up */}
        <div className="issue-thumb">
          <img src={issue.photo_url || '/issue-placeholder.png'} alt="" loading="lazy" />
        </div>
        <div className="issue-row-text">
          <p className="eyebrow">{style.label}</p>
          <h3>{issue.request_type.replace(/ Case$/, '')}</h3>
          <p className="tile-meta">{issue.address ?? issue.local_area}</p>
          <p className="tile-foot">
            <span className={`tile-meta ${issue.days_open >= 14 ? 'overdue' : ''}`}>{meta}</span>
            {!!issue.comment_count && (
              <span className="comment-count" aria-label={`${issue.comment_count} comments`}>
                <MessageCircle size={13} aria-hidden="true" />
                {issue.comment_count}
              </span>
            )}
          </p>
        </div>
      </Link>
      <div className="issue-row-vote">
        <VoteControl issue={issue} onVote={onVote} compact />
      </div>
    </article>
  )
}
