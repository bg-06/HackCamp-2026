import { CircleUser, House, Map, MessagesSquare } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

// "end" only on Home: Home covers "/" and "/fix", Forum stays highlighted inside a thread (/forum/:id).
const ITEMS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/forum', label: 'Forum', icon: MessagesSquare, end: false },
  { to: '/map', label: 'Map', icon: Map, end: false },
  { to: '/me', label: 'Profile', icon: CircleUser, end: false },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="bottom-nav" aria-label="Main">
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          // Home stays highlighted on the Issues tab and on an event page opened from Home
          className={({ isActive }) =>
            isActive || (to === '/' && (pathname === '/fix' || pathname.startsWith('/events/'))) ? 'active' : ''
          }
        >
          <Icon size={22} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
