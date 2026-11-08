import { lazy, Suspense } from 'react'

const MapPreview = lazy(() => import('./MapPreview'))

interface Props {
  lat?: number
  lng?: number
  label: string // the address or place name
}

/** "Where": the place in words, a small map, and a link to directions in the phone's map app. */
export default function PlaceSection({ lat, lng, label }: Props) {
  const hasPlace = lat !== undefined && lng !== undefined
  return (
    <section className="detail-section" aria-labelledby="where-heading">
      <h2 id="where-heading">Where</h2>
      <p>{label}</p>
      {hasPlace ? (
        <>
          <Suspense fallback={<div className="map-preview" aria-hidden="true" />}>
            <MapPreview lat={lat} lng={lng} label={label} />
          </Suspense>
          <a
            className="text-link"
            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Directions ↗
          </a>
        </>
      ) : (
        <p className="muted">No fixed place. You choose where.</p>
      )}
    </section>
  )
}
