import { useState } from 'react'
import type { VolunteerEvent } from '../types'

// Orgs will be able to post their own listings, so only plain web links get through
// (a "javascript:" link here would run on click).
function safeLink(url?: string) {
  try {
    const u = new URL(url ?? '')
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}

interface Props {
  event: VolunteerEvent
  onToggleGoing: () => void
}

// The one thing to do on a volunteer page. Lives in the bar at the bottom so it stays in reach.
export default function VolunteerAction({ event, onToggleGoing }: Props) {
  const [openedAt] = useState(Date.now)
  const going = Boolean(event.going)
  const total = event.spotsTotal
  const taken = (event.spotsTaken ?? 0) + (going ? 1 : 0)
  const full = total !== undefined && taken >= total && !going

  // can still be opened from an old link
  if (event.endsAt && Date.parse(event.endsAt) < openedAt) return <p className="muted">This one has finished.</p>

  if (event.signupUrl) {
    const link = safeLink(event.signupUrl)
    if (!link) return <p className="muted">Ask the organiser how to sign up.</p>
    return (
      <>
        <a className="action-button" href={link.href} target="_blank" rel="noopener noreferrer">
          Sign up on {link.hostname.replace(/^www\./, '')} ↗
        </a>
        <p className="muted small">Opens the organiser's site.</p>
      </>
    )
  }

  return (
    <>
      <button className={`action-button ${going ? 'on' : ''}`} aria-pressed={going} disabled={full} onClick={onToggleGoing}>
        {full ? 'Full' : going ? "You're signed up" : "I'm in"}
      </button>
      {going && <p className="muted small">Can't make it? Tap again to cancel.</p>}
    </>
  )
}
