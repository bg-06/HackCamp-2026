import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'

// Free, no-key tiles from OpenFreeMap (plan.md section 3). "positron" is the plain grey style.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

interface Props {
  lat: number
  lng: number
  label: string // what's at the pin, for screen readers
}

/** A small, still map with one pin. Loaded lazily, so the feed doesn't pay for MapLibre. */
export default function MapPreview({ lat, lng, label }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE_URL,
      center: [lng, lat],
      zoom: 15,
      interactive: false, // a preview; "Directions" opens a real map app
      attributionControl: { compact: true },
    })
    new maplibregl.Marker({ color: '#13293d' }).setLngLat([lng, lat]).addTo(map)
    return () => map.remove()
  }, [lat, lng])

  return <div ref={ref} className="map-preview" role="img" aria-label={`Map showing ${label}`} />
}
