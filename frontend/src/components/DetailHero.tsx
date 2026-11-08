import { ChevronLeft } from 'lucide-react'
import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'

// If the map code itself can't be downloaded, show the plain backdrop instead of breaking the page.
const MapPreview = lazy(() => import('./MapPreview').catch(() => ({ default: () => null })))

interface Props {
  title: string
  lat?: number
  lng?: number
  place: string // for the map's screen-reader label
  onBack: () => void
  children?: ReactNode // round buttons under the title, on the right
}

// Map across the top with the name set big over it, like a place page in a food-ranking app.
export default function DetailHero({ title, lat, lng, place, onBack, children }: Props) {
  const [mapFailed, setMapFailed] = useState(false)
  const onFail = useCallback(() => setMapFailed(true), [])
  const hasPlace = lat !== undefined && lng !== undefined

  return (
    <header className="detail-hero">
      <div className="detail-hero-map">
        {hasPlace && !mapFailed && (
          <Suspense fallback={null}>
            <MapPreview lat={lat} lng={lng} label={place} onFail={onFail} zoom={14} />
          </Suspense>
        )}
      </div>
      <div className="detail-hero-fade" aria-hidden="true" />
      <button className="hero-back" onClick={onBack} aria-label="Back">
        <ChevronLeft size={34} strokeWidth={2.2} />
      </button>
      <div className="detail-hero-bottom">
        <h1 className="hero-title">{title}</h1>
        {children && <div className="hero-actions">{children}</div>}
      </div>
    </header>
  )
}
