import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, type ReactElement } from 'react'
import { useIsDark } from '../lib/theme'

// CARTO basemaps: no API key, a matched light (Voyager) and dark (Dark Matter) pair built for app backgrounds.
// Free for non-commercial use up to 75k map views a month; the styles carry their own OSM/CARTO credit.
// Fully free fallback with no limits, same idea: VersaTiles
//   https://tiles.versatiles.org/assets/styles/colorful/style.json and .../colorful-dark/style.json
const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
}
const PIN = { light: '#d0103a', dark: '#e0193f' } // the app's accent in each theme

interface Props {
  lat: number
  lng: number
  label: string // what's at the pin, for screen readers
  onFail: () => void // no WebGL, or the tiles can't be reached
  zoom?: number
}

export default function MapPreview({ lat, lng, label, onFail, zoom = 15 }: Props): ReactElement | null {
  const ref = useRef<HTMLDivElement>(null)
  const mode = useIsDark() ? 'dark' : 'light'

  useEffect(() => {
    if (!ref.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style: STYLES[mode],
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

    new maplibregl.Marker({ color: PIN[mode], scale: 0.9 }).setLngLat([lng, lat]).addTo(map)
    return () => {
      clearTimeout(timer)
      map.remove()
    }
  }, [lat, lng, onFail, zoom, mode])

  return <div ref={ref} className="map-preview" role="img" aria-label={`Map showing ${label}`} />
}
