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
  const onFail = useCallback(() => setMapFailed(true), [])
  const hasPlace = lat !== undefined && lng !== undefined

  return (
    <section className="detail-section" aria-labelledby="where-heading">
      <h2 id="where-heading">Where</h2>
      <div className="place-heading-line">
        <p>{label}</p>
        {hasPlace && (
          <a className="chip-button directions-button" href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer">
            Directions ↗
          </a>
        )}
      </div>
      {hasPlace ? (
        <>
          {!mapFailed && (
            <Suspense fallback={<div className="map-preview" aria-hidden="true" />}>
              <MapPreview lat={lat} lng={lng} label={label} onFail={onFail} />
            </Suspense>
          )}
          {mapFailed && <p className="muted" role="status">The map couldn't load. You can still open directions.</p>}
        </>
      ) : (
        <p className="muted">No fixed place. You choose where.</p>
      )}
    </section>
  )
}
