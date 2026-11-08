import { TriangleAlert } from 'lucide-react'
import { DAILY_VOTES } from '../lib/issues'
import { useFeed } from '../state/feed'

// "1 of 2 votes left today", or a warning once a vote was refused for going over.
export default function VotesLeft() {
  const { voteBudget, voteLimitHit, signedIn } = useFeed()
  if (!voteBudget || !signedIn) return <p className="muted small">Choose up to {DAILY_VOTES} issues to prioritize. You can change your votes anytime.</p>

  const { votesRemaining: left, limit } = voteBudget
  if (voteLimitHit || left === 0)
    return (
      <p className="form-error" role="status">
        <TriangleAlert size={16} aria-hidden="true" />
        Your {limit} votes are in use. Choose another issue to compare your priorities.
      </p>
    )
  return (
    <p className="muted small" role="status">
      {left} of {limit} votes available. You can change your votes anytime.
    </p>
  )
}
