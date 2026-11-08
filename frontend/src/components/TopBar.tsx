import { Menu, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { FeedTab } from '../types'

interface Props {
  tab: FeedTab
  searchOpen: boolean
  onToggleSearch: () => void
  menuOpen: boolean
  onToggleMenu: () => void
}

const TABS: { key: FeedTab; label: string; to: string }[] = [
  { key: 'volunteer', label: 'Volunteer', to: '/' },
  { key: 'issues', label: 'Issues', to: '/issues' },
]

// Photo-feed header: menu (sort + near me) on the left, the two feeds as tabs, search on the right.
export default function TopBar({ tab, searchOpen, onToggleSearch, menuOpen, onToggleMenu }: Props) {
  return (
    <div className="top-bar">
      <button className={`icon-button ${menuOpen ? 'active' : ''}`} onClick={onToggleMenu} aria-label="Sort and location" aria-expanded={menuOpen}>
        <Menu size={24} />
      </button>
      <nav className="feed-tabs" aria-label="Feeds">
        {TABS.map((t) => (
          <Link key={t.key} to={t.to} className={tab === t.key ? 'active' : ''} aria-current={tab === t.key ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      <button className={`icon-button ${searchOpen ? 'active' : ''}`} onClick={onToggleSearch} aria-label={searchOpen ? 'Close search' : 'Search'} aria-expanded={searchOpen}>
        {searchOpen ? <X size={24} /> : <Search size={24} />}
      </button>
    </div>
  )
}
