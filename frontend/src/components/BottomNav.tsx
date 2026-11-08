import { CircleUser, HandHeart, Vote } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Volunteer', icon: HandHeart },
  { to: '/issues', label: 'Issues', icon: Vote },
  { to: '/me', label: 'Profile', icon: CircleUser },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  // Detail pages count as their tab. Plain Link, because NavLink would set its own aria-current.
  const isActive = (to: string) => (to === '/' ? pathname === '/' || pathname.startsWith('/volunteer/') : pathname.startsWith(to))

  return (
    <nav className="bottom-nav" aria-label="Main">
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className={isActive(to) ? 'active' : ''} aria-current={isActive(to) ? 'page' : undefined}>
          <Icon size={22} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
