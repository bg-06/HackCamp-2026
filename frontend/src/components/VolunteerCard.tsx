import { useState } from 'react'
import { KIND_LABELS } from '../data/categories'
import { requestTypeInSentence } from '../lib/cover'
import type { VolunteerEvent } from '../types'

interface Props {
  event: VolunteerEvent
  going: boolean // the current user has signed up (in-app only)
  onToggleGoing: (id: string) => void
}

const TZ = 'America/Vancouver'

// "Sat, Nov 15, 10:00am–12:00pm", always in Vancouver time.
function formatWhen(startsAt: string, endsAt: string) {
  const day = new Date(startsAt).toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()
  return `${day}, ${time(startsAt)}–${time(endsAt)}`
}

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

export default function VolunteerCard({ event, going, onToggleGoing }: Props) {
  const [openedAt] = useState(Date.now)
  const ended = Date.parse(event.endsAt) < openedAt // can still be opened from an old link
  const external = Boolean(event.signupUrl)
  const link = safeLink(event.signupUrl)
  const total = event.spotsTotal
  const taken = (event.spotsTaken ?? 0) + (going ? 1 : 0)
  const full = total !== undefined && taken >= total && !going
  const left = total !== undefined ? Math.max(total - taken, 0) : 0

  return (
    <article className="detail">
      {event.photoUrl && <img className="detail-photo" src={event.photoUrl} alt="" />}

      <p className="eyebrow">
        {KIND_LABELS[event.kind].label}
        {event.sample && ' · Sample listing'}
      </p>
      <h1>{event.title}</h1>
      <p className="muted">{event.organiser}</p>

      <dl className="facts">
        <dt>When</dt>
        <dd>{formatWhen(event.startsAt, event.endsAt)}</dd>
        {event.whatToBring && (
          <>
            <dt>Bring</dt>
            <dd>{event.whatToBring}</dd>
          </>
        )}
      </dl>

      {event.hotspot && (
        <p className="why-here">
          {requestTypeInSentence(event.hotspot.requestType)} has been reported here {event.hotspot.timesReported} times in the last{' '}
          {event.hotspot.monthsSeen} months.
        </p>
      )}

      {!external && total !== undefined && (
        <div className="spots">
          <p>
            {taken} of {total} signed up · {taken >= total ? 'full' : `${left} ${left === 1 ? 'spot' : 'spots'} left`}
          </p>
          <progress value={Math.min(taken, total)} max={total} aria-label={`${taken} of ${total} spots taken`} />
        </div>
      )}

      <div className="card-action">
        {ended ? (
          <p className="muted">This one has finished.</p>
        ) : external ? (
          link ? (
            <>
              <a className="action-button" href={link.href} target="_blank" rel="noopener noreferrer">
                Sign up on {link.hostname.replace(/^www\./, '')} ↗
              </a>
              <p className="muted small">Opens the organiser's site.</p>
            </>
          ) : (
            <p className="muted">Ask the organiser how to sign up.</p>
          )
        ) : (
          <>
            <button
              className={`action-button ${going ? 'on' : ''}`}
              aria-pressed={going}
              disabled={full}
              onClick={() => onToggleGoing(event.id)}
            >
              {full ? 'Full' : going ? "You're signed up" : "I'm in"}
            </button>
            {going && <p className="muted small">Can't make it? Tap again to cancel.</p>}
          </>
        )}
      </div>
    </article>
  )
}
