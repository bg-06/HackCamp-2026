import { Clock, MapPin, ThumbsUp, Users } from 'lucide-react'
import { EVENT_CATEGORIES, ISSUE_CATEGORIES } from '../data/categories'
import type { CoverSize, Post } from '../types'

const COVER_HEIGHT: Record<CoverSize, number> = { short: 110, medium: 150, tall: 190 }

interface Props {
  post: Post
  active: boolean // "me too" pressed for issues, "joined" for events
  onToggle: (id: string) => void
}

// Noon avoids the date shifting a day because of time zones.
function formatDate(date: string) {
  const d = new Date(`${date}T12:00:00`)
  return {
    weekday: d.toLocaleDateString('en-CA', { weekday: 'short' }),
    day: d.getDate(),
  }
}

export default function PostCard({ post, active, onToggle }: Props) {
  const style = post.kind === 'issue' ? ISSUE_CATEGORIES[post.category] : EVENT_CATEGORIES[post.category]
  const Icon = style.icon

  return (
    <article className="post-card">
      <div className="post-cover" style={{ height: COVER_HEIGHT[post.cover], background: style.bg, color: style.fg }}>
        <Icon size={40} strokeWidth={1.6} aria-hidden="true" />

        {post.kind === 'issue' ? (
          <span className={`cover-badge ${post.daysOpen >= 14 ? 'overdue' : ''}`}>
            <Clock size={12} aria-hidden="true" /> Open {post.daysOpen} {post.daysOpen === 1 ? 'day' : 'days'}
          </span>
        ) : (
          <span className="date-badge">
            <span>{formatDate(post.date).weekday}</span>
            <strong>{formatDate(post.date).day}</strong>
          </span>
        )}
      </div>

      <div className="post-body">
        <span className="post-tag" style={{ color: style.fg }}>
          {style.label}
        </span>
        <h3>{post.title}</h3>
        <p className="post-meta">
          <MapPin size={13} aria-hidden="true" />
          {post.location}
        </p>
        {post.kind === 'event' && <p className="post-meta">{post.time}</p>}
        {post.kind === 'event' && post.linkedIssues ? <p className="post-link">Tackles {post.linkedIssues} open issues</p> : null}

        <div className="post-footer">
          {post.kind === 'issue' ? (
            <button className={`chip-button ${active ? 'on' : ''}`} aria-pressed={active} onClick={() => onToggle(post.id)}>
              <ThumbsUp size={14} aria-hidden="true" />
              Me too · {post.meToo + (active ? 1 : 0)}
            </button>
          ) : (
            <>
              <span className="post-meta">
                <Users size={13} aria-hidden="true" />
                {post.going + (active ? 1 : 0)} going
              </span>
              <button className={`chip-button ${active ? 'on' : ''}`} aria-pressed={active} onClick={() => onToggle(post.id)}>
                {active ? 'Joined' : 'Join'}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
