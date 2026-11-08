import { ExternalLink, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categoryStyle, KIND_LABELS } from '../data/categories'
import { formatKm } from '../lib/geo'
import type { EventKind, VolunteerEvent } from '../types'

const TZ = 'America/Vancouver'

// Short labels for the small badge on the photo. The event page shows the full label.
const SHORT_KIND: Record<EventKind, string> = { city: 'City', org: 'Local org', hotspot: 'Neighbours' }

interface Props {
  event: VolunteerEvent
  ratio: number
  distanceKm?: number
}

/** A photo-first card for the two-column feed. Tapping it opens the event page. */
export default function EventTile({ event, ratio, distanceKm }: Props) {
  const style = categoryStyle(event.category)
  const Icon = style.icon
  const start = new Date(event.startsAt)
  const weekday = start.toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'short' })
  const day = start.toLocaleDateString('en-CA', { timeZone: TZ, day: 'numeric' })
  const time = start
    .toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
    .replace(':00', '')
    .replace(' ', '')
    .toLowerCase()

  const total = event.spotsTotal
  const taken = (event.spotsTaken ?? 0) + (event.going ? 1 : 0)

  return (
    <Link className="tile" to={`/events/${encodeURIComponent(event.id)}`}>
      <div
        className="tile-cover"
        style={{
          aspectRatio: `1 / ${ratio}`,
          background: `linear-gradient(160deg, ${style.bg}, color-mix(in srgb, ${style.fg} 28%, ${style.bg}))`,
          color: style.fg,
        }}
      >
        {event.photoUrl ? (
          <img src={event.photoUrl} alt="" loading="lazy" />
        ) : (
          <Icon size={56} strokeWidth={1.4} aria-hidden="true" />
        )}
        <span className="date-badge">
          <span>{weekday}</span>
          <strong>{day}</strong>
        </span>
        <span className={`tile-kind ${KIND_LABELS[event.kind].className}`} title={KIND_LABELS[event.kind].label}>
          {SHORT_KIND[event.kind]}
        </span>
        {distanceKm !== undefined && <span className="tile-pill">{formatKm(distanceKm)}</span>}
        {event.sample && <span className="tile-sample">Sample</span>}
      </div>

      <div className="tile-body">
        <h3>{event.title}</h3>
        <p className="tile-foot">
          <span>{time}</span>
          {event.signupUrl ? (
            <span className="tile-external">
              Sign up <ExternalLink size={12} aria-hidden="true" />
            </span>
          ) : total !== undefined ? (
            <span className={event.going ? 'tile-going' : ''}>
              <Users size={13} aria-hidden="true" />
              {event.going ? "You're in" : taken >= total ? 'Full' : `${taken}/${total}`}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  )
}
