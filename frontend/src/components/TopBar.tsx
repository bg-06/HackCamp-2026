import { ListFilter, Search, X } from 'lucide-react'
import type { FeedTab } from '../types'

interface Props {
  tab: FeedTab
  onTabChange: (tab: FeedTab) => void
  filtersOpen: boolean
  filtersActive: boolean // a sort other than the default is on
  onToggleFilters: () => void
  searchOpen: boolean
  onToggleSearch: () => void
}

// Track 1 (neighbours can help) and Track 2 (only the City can fix it).
const TABS: { key: FeedTab; label: string }[] = [
  { key: 'help', label: 'Events' },
  { key: 'fix', label: 'Issues' },
]

export default function TopBar({ tab, onTabChange, filtersOpen, filtersActive, onToggleFilters, searchOpen, onToggleSearch }: Props) {
  return (
    <div className="top-bar">
      <button
        className={`icon-button ${filtersOpen ? 'active' : ''}`}
        onClick={onToggleFilters}
        aria-label={filtersActive ? 'Sort (changed)' : 'Sort'}
        aria-expanded={filtersOpen}
      >
        <ListFilter size={22} />
        {filtersActive && <span className="dot" aria-hidden="true" />}
      </button>

      <div className="segmented" role="tablist" aria-label="Show events or issues">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`${tab === t.key ? 'selected' : ''} tab-${t.key}`}
            onClick={() => onTabChange(t.key)}
          >
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
