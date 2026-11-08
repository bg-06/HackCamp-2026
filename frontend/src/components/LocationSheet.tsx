import { Check, LocateFixed, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CITIES, type City } from '../lib/geo'

export type LocateStatus = 'idle' | 'locating' | 'found' | 'outside' | 'denied' | 'unavailable' | 'insecure'

interface Props {
  city: City
  status: LocateStatus
  onUseLocation: () => void
  onPickCity: (city: City) => void
  onClose: () => void
}

const STATUS_TEXT: Record<LocateStatus, string | null> = {
  idle: null,
  locating: null, // the button already says it
  found: "Using your location. 'Nearest' now sorts from where you are.",
  outside: "You're outside Vancouver. We only have Vancouver data so far, but distances are from where you are.",
  denied: 'Location is turned off. Allow it in your browser settings, or pick a city below.',
  unavailable: "Couldn't get your location. Pick a city below.",
  // e.g. testing on a phone at http://192.168.x.x: browsers only give location over https
  insecure: 'Location only works over https. Pick a city below.',
}

export default function LocationSheet({ city, status, onUseLocation, onPickCity, onClose }: Props) {
  const [query, setQuery] = useState('')
  const firstButton = useRef<HTMLButtonElement>(null)

  // Focus the sheet when it opens, hand focus back to whatever opened it, close on Escape.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    firstButton.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [onClose])

  const q = query.trim().toLowerCase()
  const cities = CITIES.filter((c) => c.name.toLowerCase().includes(q))
  const note = STATUS_TEXT[status]

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id="location-sheet-title">Your city</h2>
          <button className="icon-button plain" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <button ref={firstButton} className="locate-button" onClick={onUseLocation} disabled={status === 'locating'}>
          <LocateFixed size={20} aria-hidden="true" />
          {status === 'locating' ? 'Finding you…' : 'Use my current location'}
        </button>
        {note && (
          <p className={`sheet-note ${status === 'denied' || status === 'unavailable' || status === 'insecure' ? 'warn' : ''}`} role="status">
            {note}
          </p>
        )}

        <label className="sheet-search">
          <Search size={18} aria-hidden="true" />
          <span className="visually-hidden">Search a city</span>
          <input type="search" placeholder="Search a city" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>

        <ul className="city-list">
          {cities.map((c) => (
            <li key={c.name}>
              <button
                className={`city-option ${c.name === city.name ? 'selected' : ''}`}
                disabled={!c.available}
                aria-current={c.name === city.name ? 'true' : undefined}
                onClick={() => onPickCity(c)}
              >
                <span>{c.name}</span>
                {c.name === city.name ? (
                  <Check size={18} aria-label="Selected" />
                ) : (
                  !c.available && <span className="soon">Coming soon</span>
                )}
              </button>
            </li>
          ))}
          {cities.length === 0 && <li className="sheet-note">No city matches “{query}”.</li>}
        </ul>
      </div>
    </div>
  )
}
