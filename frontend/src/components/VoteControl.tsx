import { ChevronDown, ChevronUp } from 'lucide-react'
import { issueScore } from '../lib/issues'
import type { Track2Issue, Vote } from '../types'

interface Props {
  issue: Track2Issue
  onVote: (id: string, value: Vote) => void
  compact?: boolean // in a feed card: no labels under the buttons
}

export default function VoteControl({ issue, onVote, compact }: Props) {
  const { up, down, score } = issueScore(issue)
  const title = issue.request_type.replace(/ Case$/, '')
  // tapping your current vote again clears it
  const vote = (value: 1 | -1) => onVote(issue.issue_id, issue.my_vote === value ? 0 : value)

  return (
    <div className={`vote-control ${compact ? 'compact' : ''}`} role="group" aria-label={`Vote on ${title}`}>
      <button
        className={`vote-button up ${issue.my_vote === 1 ? 'on' : ''}`}
        aria-pressed={issue.my_vote === 1}
        aria-label={`Pressing (${up})`}
        title="This affects me, it's pressing"
        onClick={() => vote(1)}
      >
        <ChevronUp size={20} aria-hidden="true" />
        {!compact && <span>Pressing</span>}
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
        {!compact && <span>Not a problem</span>}
      </button>
    </div>
  )
}
