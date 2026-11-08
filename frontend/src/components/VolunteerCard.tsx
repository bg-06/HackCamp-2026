import { Globe, List, Navigation } from 'lucide-react'
import { categoryStyle, KIND_LABELS } from '../data/categories'
import { requestTypeInSentence } from '../lib/cover'
import type { VolunteerEvent } from '../types'
import ScoreRing from './ScoreRing'

const TZ = 'America/Vancouver'

// "Sat, Nov 15, 10:00am–12:00pm", always in Vancouver time.
function formatWhen(startsAt: string | null, endsAt: string | null) {
  if (!startsAt) return 'Ongoing program'
  const day = new Date(startsAt).toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()
  return endsAt ? `${day}, ${time(startsAt)}–${time(endsAt)}` : `${day}, ${time(startsAt)}`
}

function safeHost(url?: string) {
  try {
    const u = new URL(url ?? '')
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}

// The details, under the map header. The sign-up button is in VolunteerAction, pinned to the bottom of the page.
export default function VolunteerCard({ event }: { event: VolunteerEvent }) {
  const total = event.spotsTotal
  const taken = (event.spotsTaken ?? 0) + (event.going ? 1 : 0)
  const left = total !== undefined ? Math.max(total - taken, 0) : 0
  const category = categoryStyle(event.category).label
  const site = safeHost(event.signupUrl)
  const hasPlace = event.lat !== undefined && event.lng !== undefined

  return (
    <article className="detail">
      <div className="tag-row">
        <span className="tag-pill">
          <List size={16} aria-hidden="true" />
          {KIND_LABELS[event.kind].label}
        </span>
        <span className="tag-pill">
          <List size={16} aria-hidden="true" />
          {category}
        </span>
        {event.sample && <span className="tag-pill">Sample listing</span>}
      </div>

      <p className="accent-line">{[category, event.localArea, formatWhen(event.startsAt, null)].join(' · ')}</p>
      <p className="strong-line">{event.organiser}</p>
      <p className="place-line">
        {event.location}, {event.localArea}
      </p>

      <div className="pill-row">
        {site && (
          <a className="pill-button" href={site.href} target="_blank" rel="noopener noreferrer">
            <Globe size={20} aria-hidden="true" />
            Website
          </a>
        )}
        {hasPlace && (
          <a
            className="pill-button"
            href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={20} aria-hidden="true" />
            Directions
          </a>
        )}
      </div>

      {(total !== undefined || event.hotspot) && (
        <section className="detail-block" aria-labelledby="scores-heading">
          <h2 id="scores-heading">At a glance</h2>
          <div className="score-row">
            {total !== undefined && !event.signupUrl && (
              <ScoreRing value={left} title={taken >= total ? 'Full' : 'Spots left'} sub={`${taken} of ${total} signed up`} badge={taken} />
            )}
            {event.hotspot && (
              <ScoreRing
                value={event.hotspot.timesReported}
                title="Reports here"
                sub={`in the last ${event.hotspot.monthsSeen} months`}
                tone="warn"
              />
            )}
          </div>
        </section>
      )}

      <section className="detail-block" aria-labelledby="details-heading">
        <h2 id="details-heading">Details</h2>
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
        {!hasPlace && <p className="muted">No fixed place. You choose where.</p>}
      </section>

      {event.photoUrl && (
        <section className="detail-block" aria-labelledby="photos-heading">
          <h2 id="photos-heading">Photos</h2>
          <div className="photo-strip">
            <figure>
              <img src={event.photoUrl} alt="" />
              <figcaption>
                <strong>Before</strong>
                <span>From the organiser</span>
              </figcaption>
            </figure>
          </div>
        </section>
      )}
    </article>
  )
}
