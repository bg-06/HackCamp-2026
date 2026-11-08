import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categoryStyle } from '../data/categories'
import { formatKm } from '../lib/geo'
import type { VolunteerEvent } from '../types'

const TZ = 'America/Vancouver'

interface Props {
  event: VolunteerEvent
  ratio: number
  distanceKm?: number
}

// Photo-feed card: cover with a caption over it, a bold title, then organiser on the left and a count on the right.
export default function EventTile({ event, ratio, distanceKm }: Props) {
  const style = categoryStyle(event.category)
  const Icon = style.icon
  const start = event.startsAt ? new Date(event.startsAt) : null
  const when = start ? start.toLocaleDateString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric' }) : 'Ongoing'
  const where = distanceKm !== undefined ? formatKm(distanceKm) : event.localArea
  const going = (event.spotsTaken ?? 0) + (event.going ? 1 : 0)

  return (
    <Link className="tile" to={`/volunteer/${encodeURIComponent(event.id)}`}>
      <div className="tile-cover" style={{ aspectRatio: `1 / ${ratio}`, background: style.bg, color: style.fg }}>
        {event.photoUrl ? <img src={event.photoUrl} alt="" loading="lazy" /> : <Icon size={44} strokeWidth={1.3} aria-hidden="true" />}
        <span className="tile-caption">
          {when} · {where}
        </span>
      </div>
      <div className="tile-body">
        <h3>{event.title}</h3>
        {event.hotspot && <p className="tile-why">Reported {event.hotspot.timesReported}× here</p>}
        <p className="tile-foot">
          <span className="tile-author">
            <span className="mini-avatar" aria-hidden="true">
              {event.organiser.charAt(0).toUpperCase()}
            </span>
            <span className="tile-meta">{event.organiser}</span>
          </span>
          <span className={`like-count ${event.going ? 'on' : ''}`} aria-label={`${going} going`}>
            <Heart size={16} aria-hidden="true" fill={event.going ? 'currentColor' : 'none'} />
            {going}
          </span>
        </p>
      </div>
    </Link>
  )
}
