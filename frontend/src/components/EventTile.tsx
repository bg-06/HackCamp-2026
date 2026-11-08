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
  const when = event.startsAt
    ? new Date(event.startsAt).toLocaleDateString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric' })
    : 'Ongoing'
  const meta = [distanceKm !== undefined ? formatKm(distanceKm) : null, event.sample ? 'Sample' : null].filter(Boolean).join(' · ')

  return (
    <Link className="tile" to={`/volunteer/${encodeURIComponent(event.id)}`}>
      <div className="tile-cover" style={{ aspectRatio: `1 / ${ratio}`, background: style.bg, color: style.fg }}>
        {event.photoUrl ? <img src={event.photoUrl} alt="" loading="lazy" /> : <Icon size={32} strokeWidth={1.5} aria-hidden="true" />}
        <span className="tile-tag">{when}</span>
      </div>
      <div className="tile-body">
        <p className="eyebrow">{KIND_LABELS[event.kind].label}</p>
        <h3>{event.title}</h3>
        {meta && <p className="tile-meta">{meta}</p>}
      </div>
    </Link>
  )
}
