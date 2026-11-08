import { ChevronUp } from 'lucide-react'
import { issueScore } from '../lib/issues'
import type { Track2Issue, Vote } from '../types'

interface Props {
  issue: Track2Issue
  onVote: (id: string, value: Vote) => void
  outOfVotes?: boolean // today's votes are used up
  compact?: boolean // in the list: no label on the button
}

export default function VoteControl({ issue, onVote, outOfVotes, compact }: Props) {
  const { up, score } = issueScore(issue)
  const voted = issue.my_vote === 1
  const title = issue.request_type.replace(/ Case$/, '')

  return (
    <div className={`vote-control ${compact ? 'compact' : ''}`} role="group" aria-label={`Vote on ${title}`}>
      <button
        className={`vote-button up ${voted ? 'on' : ''}`}
        aria-pressed={voted}
        aria-label={`Pressing (${up} ${up === 1 ? 'vote' : 'votes'})`}
        title={outOfVotes && !voted ? "You've used today's votes" : "This affects me, it's pressing"}
        // tapping your vote again takes it back
        onClick={() => onVote(issue.issue_id, voted ? 0 : 1)}
        disabled={outOfVotes && !voted}
      >
        <ChevronUp size={20} aria-hidden="true" />
        {!compact && <span>{voted ? 'Voted' : 'Pressing'}</span>}
      </button>
      <span className="vote-score" aria-label={`Score ${Math.round(score)}`}>
        {Math.round(score)}
      </span>
    </div>
  )
}
