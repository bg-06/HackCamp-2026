import { ListFilter, Search, X } from 'lucide-react'

interface Props {
  title: string
  filtersOpen: boolean
  filtersActive: boolean // a sort other than the default is on
  onToggleFilters: () => void
  searchOpen: boolean
  onToggleSearch: () => void
}

export default function TopBar({ title, filtersOpen, filtersActive, onToggleFilters, searchOpen, onToggleSearch }: Props) {
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

      <h1 className="header-title">{title}</h1>

      <button className={`icon-button ${searchOpen ? 'active' : ''}`} onClick={onToggleSearch} aria-label={searchOpen ? 'Close search' : 'Search'} aria-expanded={searchOpen}>
        {searchOpen ? <X size={22} /> : <Search size={22} />}
      </button>
    </div>
  )
}
