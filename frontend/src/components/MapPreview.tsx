import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, type ReactElement } from 'react'
import { useIsDark } from '../lib/theme'

// Match the map to the selected appearance.
const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
}

interface Props {
  lat: number
  lng: number
  label: string // what's at the pin, for screen readers
  onFail: () => void // no WebGL, or the tiles can't be reached
}

export default function MapPreview({ lat, lng, label, onFail }: Props): ReactElement | null {
  const ref = useRef<HTMLDivElement>(null)
  const dark = useIsDark()

  useEffect(() => {
    if (!ref.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style: dark ? STYLES.dark : STYLES.light,
        center: [lng, lat],
        zoom: 15,
        interactive: true,
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
      // MapLibre initially expands compact attribution; start with just its info button.
      const attribution = map.getContainer().querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib.maplibregl-compact')
      attribution?.classList.remove('maplibregl-compact-show')
      attribution?.removeAttribute('open')
    })
    map.on('error', () => !loaded && onFail())

    map.scrollZoom.disable()
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    new maplibregl.Marker({ color: '#2563eb' }).setLngLat([lng, lat]).addTo(map)
    return () => {
      clearTimeout(timer)
      map.remove()
    }
  }, [lat, lng, onFail, dark])

  return <div ref={ref} className="map-preview" role="region" aria-label={`Interactive map showing ${label}`} />
}
