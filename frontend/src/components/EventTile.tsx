import { MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categoryStyle, KIND_LABELS } from '../data/categories'
import { formatKm } from '../lib/geo'
import type { VolunteerEvent } from '../types'

const TZ = 'America/Vancouver'

interface Props {
  event: VolunteerEvent
  ratio: number
  distanceKm?: number
}

export default function EventTile({ event, ratio, distanceKm }: Props) {
  const style = categoryStyle(event.category)
  const Icon = style.icon
  const start = event.startsAt ? new Date(event.startsAt) : null
  const when = start ? start.toLocaleDateString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric' }) : 'Ongoing'
  const time = start
    ? start.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(' ', '').toLowerCase()
    : null
  // where and when, the two things people decide on
  const meta = [distanceKm !== undefined ? formatKm(distanceKm) : event.localArea, time].filter(Boolean).join(' · ')

  return (
    <Link className="tile" to={`/volunteer/${encodeURIComponent(event.id)}`}>
      <div className="tile-cover" style={{ aspectRatio: `1 / ${ratio}`, background: style.bg, color: style.fg }}>
        {event.photoUrl ? <img src={event.photoUrl} alt="" loading="lazy" /> : <Icon size={32} strokeWidth={1.5} aria-hidden="true" />}
        <span className="tile-tag">{when}</span>
      </div>
      <div className="tile-body">
        {event.kind !== 'org' && <p className="eyebrow">{KIND_LABELS[event.kind].label}</p>}
        <h3>{event.title}</h3>
        <p className="tile-meta">{event.organiser}</p>
        {event.hotspot && <p className="tile-why">Reported {event.hotspot.timesReported}× here</p>}
        <p className="tile-foot">
          <span className="tile-meta">{meta}</span>
          {!!event.commentCount && (
            <span className="comment-count" aria-label={`${event.commentCount} comments`}>
              <MessageCircle size={13} aria-hidden="true" />
              {event.commentCount}
            </span>
          )}
        </p>
      </div>
    </Link>
  )
}
