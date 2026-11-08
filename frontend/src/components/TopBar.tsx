import { Menu, Search, X } from 'lucide-react'
import type { FeedTab } from '../types'

interface Props {
  tab: FeedTab
  searchOpen: boolean
  onToggleSearch: () => void
  menuOpen: boolean
  onToggleMenu: () => void
}

const TITLES: Record<FeedTab, string> = { volunteer: 'Volunteer', issues: 'Issues' }

// Slim header: menu (sort + near me) on the left, the page name, search on the right. The bottom bar switches feeds.
export default function TopBar({ tab, searchOpen, onToggleSearch, menuOpen, onToggleMenu }: Props) {
  return (
    <div className="top-bar">
      <button className={`icon-button ${menuOpen ? 'active' : ''}`} onClick={onToggleMenu} aria-label="Sort and location" aria-expanded={menuOpen}>
        <Menu size={24} />
      </button>
      <h1 className="header-title">{TITLES[tab]}</h1>
      <button className={`icon-button ${searchOpen ? 'active' : ''}`} onClick={onToggleSearch} aria-label={searchOpen ? 'Close search' : 'Search'} aria-expanded={searchOpen}>
        {searchOpen ? <X size={24} /> : <Search size={24} />}
      </button>
    </div>
  )
}
