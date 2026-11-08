import { CircleUser, House, Plus, Vote } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Home', icon: House },
  { to: '/issues', label: 'Issues', icon: Vote },
  { to: '/volunteer/new', label: 'Start an event', icon: Plus, primary: true },
  { to: '/me', label: 'Me', icon: CircleUser },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  // Detail pages count as their tab. Plain Link, because NavLink would set its own aria-current.
  const isActive = (to: string) =>
    to === '/'
      ? pathname === '/' || (pathname.startsWith('/volunteer/') && pathname !== '/volunteer/new')
      : pathname.startsWith(to)

  return (
    <nav className="bottom-nav" aria-label="Main">
      {ITEMS.map(({ to, label, icon: Icon, primary }) =>
        primary ? (
          <Link key={to} to={to} className="nav-plus-wrap" aria-label={label} aria-current={isActive(to) ? 'page' : undefined}>
            <span className="nav-plus">
              <Icon size={28} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </Link>
        ) : (
          <Link key={to} to={to} className={isActive(to) ? 'active' : ''} aria-current={isActive(to) ? 'page' : undefined}>
            <Icon size={24} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ),
      )}
    </nav>
  )
}
