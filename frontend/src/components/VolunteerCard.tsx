import { CalendarDays, ExternalLink, MapPin, Package, TriangleAlert } from 'lucide-react'
import { categoryStyle, KIND_LABELS } from '../data/categories'
import type { VolunteerEvent } from '../types'

interface Props {
  event: VolunteerEvent
  going: boolean // the current user has RSVP'd (in-app events only)
  onToggleGoing: (id: string) => void
}

const TZ = 'America/Vancouver'

// "Sat, Nov 15 · 10:00am–12:00pm", always in Vancouver time.
function formatWhen(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const day = start.toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' })
  const time = (d: Date) =>
    d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()
  return `${day} · ${time(start)}–${time(end)}`
}

function dateBadge(startsAt: string) {
  const d = new Date(startsAt)
  return {
    weekday: d.toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'short' }),
    day: d.toLocaleDateString('en-CA', { timeZone: TZ, day: 'numeric' }),
  }
}

function siteName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return "the organiser's site"
  }
}

export default function VolunteerCard({ event, going, onToggleGoing }: Props) {
  const style = categoryStyle(event.category)
  const kind = KIND_LABELS[event.kind]
  const Icon = style.icon
  const badge = dateBadge(event.startsAt)

  const external = Boolean(event.signupUrl)
  const total = event.spotsTotal
  const taken = (event.spotsTaken ?? 0) + (going ? 1 : 0)
  const full = total !== undefined && taken >= total && !going
  const left = total !== undefined ? Math.max(total - taken, 0) : 0

  return (
    <article className="post-card volunteer-card">
      <div className="post-cover" style={{ background: style.bg, color: style.fg }}>
        <Icon size={36} strokeWidth={1.6} aria-hidden="true" />
        <span className="date-badge" aria-hidden="true">
          <span>{badge.weekday}</span>
          <strong>{badge.day}</strong>
        </span>
      </div>

      <div className="post-body">
        <div className="badge-row">
          <span className={`kind-badge ${kind.className}`}>{kind.label}</span>
          <span className="category-chip">{style.label}</span>
          {event.sample && <span className="sample-tag">Sample</span>}
        </div>

        <h3>{event.title}</h3>
        <p className="organiser">{event.organiser}</p>

        <p className="post-meta">
          <CalendarDays size={13} aria-hidden="true" />
          {formatWhen(event.startsAt, event.endsAt)}
        </p>
        <p className="post-meta">
          <MapPin size={13} aria-hidden="true" />
          {event.location} · {event.localArea}
        </p>

        {event.hotspot && (
          <p className="why-here">
            <TriangleAlert size={13} aria-hidden="true" />
            {event.hotspot.requestType.replace(/ Case$/, '')} reported {event.hotspot.timesReported} times in{' '}
            {event.hotspot.monthsSeen} months on this block
          </p>
        )}

        {event.whatToBring && (
          <p className="post-meta">
            <Package size={13} aria-hidden="true" />
            {event.whatToBring}
          </p>
        )}

        {!external && total !== undefined && (
          <div className="spots">
            <div className="spots-label">
              <span>
                {taken} of {total} going
              </span>
              <span>{taken >= total ? 'Full' : `${left} ${left === 1 ? 'spot' : 'spots'} left`}</span>
            </div>
            <progress value={Math.min(taken, total)} max={total} aria-label={`${taken} of ${total} spots taken`} />
          </div>
        )}

        <div className="card-action">
          {external ? (
            <>
              <a className="action-button external" href={event.signupUrl} target="_blank" rel="noopener noreferrer">
                Sign up on {siteName(event.signupUrl!)} <ExternalLink size={14} aria-hidden="true" />
              </a>
              <p className="action-note">Opens the organiser's site</p>
            </>
          ) : (
            <button
              className={`action-button ${going ? 'on' : ''}`}
              aria-pressed={going}
              disabled={full}
              onClick={() => onToggleGoing(event.id)}
            >
              {full ? 'Event is full' : going ? "You're going ✓" : "I'm in"}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
