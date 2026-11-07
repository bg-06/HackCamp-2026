import { CircleUser, House, Map, Newspaper } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Home', icon: House },
  { to: '/updates', label: 'Updates', icon: Newspaper },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/profile', label: 'Profile', icon: CircleUser },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end>
          <Icon size={22} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
