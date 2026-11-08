import { CircleUser, HandHeart, Vote } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const ITEMS = [
  { to: '/', label: 'Volunteer', icon: HandHeart },
  { to: '/issues', label: 'Issues', icon: Vote },
  { to: '/me', label: 'Profile', icon: CircleUser },
]

// Fields that bring up the on-screen keyboard (selects open a picker instead).
const TEXT_INPUT = 'textarea, [contenteditable="true"], input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]):not([type=file]):not([type=color])'

// True while a touch keyboard is up. On phones the keyboard otherwise pushes the nav up so it floats over the keyboard.
function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return
    const update = () => {
      const el = document.activeElement
      setOpen(el instanceof HTMLElement && el.matches(TEXT_INPUT))
    }
    // focusout fires before focus lands on the next field, so wait a tick before deciding
    const later = () => setTimeout(update, 0)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', later)
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', later)
    }
  }, [])
  return open
}

export default function BottomNav() {
  const { pathname } = useLocation()
  const keyboardOpen = useKeyboardOpen()
  // Detail pages count as their tab. Plain Link, because NavLink would set its own aria-current.
  const isActive = (to: string) => (to === '/' ? pathname === '/' || pathname.startsWith('/volunteer/') : to === '/me' ? pathname === '/settings' || pathname === '/community-updates' || pathname.startsWith(to) : pathname.startsWith(to))

  return (
    <nav className="bottom-nav" aria-label="Main" data-keyboard={keyboardOpen ? 'open' : undefined}>
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className={isActive(to) ? 'active' : ''} aria-current={isActive(to) ? 'page' : undefined} draggable={false}>
          <Icon size={22} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
