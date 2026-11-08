import { Search, X } from 'lucide-react'

interface Props {
  title: string
  searchOpen: boolean
  onToggleSearch: () => void
}

// Sort and "Near me" live in the row under this, where you can see what's on
export default function TopBar({ title, searchOpen, onToggleSearch }: Props) {
  return (
    <div className="top-bar">
      <span aria-hidden="true" />
      <h1 className="header-title">{title}</h1>
      <button className={`icon-button ${searchOpen ? 'active' : ''}`} onClick={onToggleSearch} aria-label={searchOpen ? 'Close search' : 'Search'} aria-expanded={searchOpen}>
        {searchOpen ? <X size={22} /> : <Search size={22} />}
      </button>
    </div>
  )
}
