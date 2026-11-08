import { TriangleAlert } from 'lucide-react'
import { useFeed } from '../state/feed'

// "1 of 2 votes left today", or a warning once a vote was refused for going over.
export default function VotesLeft() {
  const { voteBudget, voteLimitHit, signedIn } = useFeed()
  if (!voteBudget || !signedIn) return <p className="muted small">You get {voteBudget?.dailyLimit ?? 2} votes a day.</p>

  const { votesRemaining: left, dailyLimit } = voteBudget
  if (voteLimitHit || left === 0)
    return (
      <p className="form-error" role="status">
        <TriangleAlert size={16} aria-hidden="true" />
        You've used today's {dailyLimit} votes. You get new ones tomorrow.
      </p>
    )
  return (
    <p className="muted small" role="status">
      {left} of {dailyLimit} votes left today. Taking a vote back doesn't give it back.
    </p>
  )
}
