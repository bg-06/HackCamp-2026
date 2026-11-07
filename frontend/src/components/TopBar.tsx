import { ListFilter, Search, X } from 'lucide-react'
import type { FeedTab } from '../types'

interface Props {
  tab: FeedTab
  onTabChange: (tab: FeedTab) => void
  filtersOpen: boolean
  onToggleFilters: () => void
  searchOpen: boolean
  onToggleSearch: () => void
}

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'events', label: 'Events' },
  { key: 'issues', label: 'Issues' },
]

export default function TopBar({ tab, onTabChange, filtersOpen, onToggleFilters, searchOpen, onToggleSearch }: Props) {
  return (
    <div className="top-bar">
      <button
        className={`icon-button ${filtersOpen ? 'active' : ''}`}
        onClick={onToggleFilters}
        aria-label="Filter by category"
        aria-expanded={filtersOpen}
      >
        <ListFilter size={22} />
      </button>

      <div className="segmented" role="tablist" aria-label="Show events or issues">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'selected' : ''} onClick={() => onTabChange(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <button className={`icon-button ${searchOpen ? 'active' : ''}`} onClick={onToggleSearch} aria-label={searchOpen ? 'Close search' : 'Search'} aria-expanded={searchOpen}>
        {searchOpen ? <X size={22} /> : <Search size={22} />}
      </button>
    </div>
  )
}
