import { lazy, Suspense, useCallback, useState } from 'react'

// If the map code itself can't be downloaded, show no map instead of breaking the page.
const MapPreview = lazy(() => import('./MapPreview').catch(() => ({ default: () => null })))

interface Props {
  lat?: number
  lng?: number
  label: string // the address or place name
}

export default function PlaceSection({ lat, lng, label }: Props) {
  const [mapFailed, setMapFailed] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const onFail = useCallback(() => setMapFailed(true), [])
  const hasPlace = lat !== undefined && lng !== undefined

  return (
    <section className="detail-section" aria-labelledby="where-heading">
      <h2 id="where-heading">Where</h2>
      <p>{label}</p>
      {hasPlace ? (
        <>
          <div className="place-actions">
            <button className="chip-button" type="button" aria-expanded={showMap} onClick={() => setShowMap(!showMap)}>
              {showMap ? 'Hide map' : 'Show map'}
            </button>
            <a className="chip-button" href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer">
              Directions ↗
            </a>
          </div>
          {showMap && !mapFailed && (
            <Suspense fallback={<div className="map-preview" aria-hidden="true" />}>
              <MapPreview lat={lat} lng={lng} label={label} onFail={onFail} />
            </Suspense>
          )}
          {showMap && mapFailed && <p className="muted" role="status">The map couldn't load. You can still open directions.</p>}
        </>
      ) : (
        <p className="muted">No fixed place. You choose where.</p>
      )}
    </section>
  )
}
