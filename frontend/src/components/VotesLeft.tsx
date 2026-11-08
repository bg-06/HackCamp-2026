import { DAILY_VOTES } from '../lib/issues'
import { useFeed } from '../state/feed'

// Active votes can be removed or moved to a different issue.
export default function VotesLeft() {
  const { voteBudget, voteLimitHit, signedIn } = useFeed()
  if (!voteBudget || !signedIn) return <p className="muted small">Choose up to {DAILY_VOTES}. Change your votes anytime.</p>

  const { votesRemaining: left, limit } = voteBudget
  if (voteLimitHit || left === 0)
    return (
      <p className="muted small" role="status">
        Both votes are in use. Choose another issue to compare.
      </p>
    )
  return (
    <p className="muted small" role="status">
      {left} of {limit} votes available. Change them anytime.
    </p>
  )
}
