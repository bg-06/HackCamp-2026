import { ChevronUp } from 'lucide-react'
import { issueScore } from '../lib/issues'
import { useFeed } from '../state/feed'
import type { Track2Issue, Vote } from '../types'

interface Props {
  issue: Track2Issue
  onVote: (id: string, value: Vote) => void
  compact?: boolean // in the list: no label on the button
}

export default function VoteControl({ issue, onVote, compact }: Props) {
  const { outOfVotes } = useFeed()
  const { up, score } = issueScore(issue)
  const voted = issue.my_vote === 1
  const title = issue.request_type.replace(/ Case$/, '')

  return (
    <div className={`vote-control ${compact ? 'compact' : ''}`} role="group" aria-label={`Vote on ${title}`}>
      <button
        className={`vote-button up ${voted ? 'on' : ''}`}
        aria-pressed={voted}
        aria-label={`Pressing (${up} ${up === 1 ? 'vote' : 'votes'})`}
        title={outOfVotes && !voted ? 'Compare your priorities' : "This affects me, it's pressing"}
        // tapping your vote again takes it back
        onClick={() => onVote(issue.issue_id, voted ? 0 : 1)}
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
