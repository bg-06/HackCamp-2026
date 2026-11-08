import { CircleUser, HandHeart, Vote } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Volunteer', icon: HandHeart },
  { to: '/issues', label: 'Issues', icon: Vote },
  { to: '/me', label: 'Profile', icon: CircleUser },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  // Volunteer covers "/" and its detail pages; Issues covers "/issues" and "/issues/:id".
  const isActive = (to: string) => (to === '/' ? pathname === '/' || pathname.startsWith('/volunteer/') : pathname.startsWith(to))

  return (
    <nav className="bottom-nav" aria-label="Main">
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={() => (isActive(to) ? 'active' : '')} aria-current={isActive(to) ? 'page' : undefined}>
          <Icon size={22} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
