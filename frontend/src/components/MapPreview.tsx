import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, type ReactElement } from 'react'

// OpenFreeMap: free, no API key. "positron" is the plain grey style.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

interface Props {
  lat: number
  lng: number
  label: string // what's at the pin, for screen readers
  onFail: () => void // no WebGL, or the tiles can't be reached
  zoom?: number
}

export default function MapPreview({ lat, lng, label, onFail, zoom = 15 }: Props): ReactElement | null {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style: STYLE_URL,
        center: [lng, lat],
        zoom,
        interactive: false, // a preview; "Directions" opens a real map app
        attributionControl: { compact: true },
      })
    } catch {
      onFail()
      return
    }

    // Give up if it hasn't drawn after 10 s. Once it has, a missing tile here and there is fine.
    let loaded = false
    const timer = setTimeout(() => !loaded && onFail(), 10000)
    map.once('load', () => {
      loaded = true
      clearTimeout(timer)
    })
    map.on('error', () => !loaded && onFail())

    new maplibregl.Marker({ color: '#7b8590', scale: 0.9 }).setLngLat([lng, lat]).addTo(map)
    return () => {
      clearTimeout(timer)
      map.remove()
    }
  }, [lat, lng, onFail, zoom])

  return <div ref={ref} className="map-preview" role="img" aria-label={`Map showing ${label}`} />
}
