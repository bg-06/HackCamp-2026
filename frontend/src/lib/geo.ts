import type { LatLng } from '../types'

export interface City {
  name: string
  centre: LatLng
  available: boolean // we only have City of Vancouver 311 data so far
}

// Metro Vancouver, by population. Only Vancouver has data; the rest show "Coming soon".
export const CITIES: City[] = [
  { name: 'Vancouver', centre: { lat: 49.2606, lng: -123.114 }, available: true },
  { name: 'Surrey', centre: { lat: 49.1913, lng: -122.849 }, available: false },
  { name: 'Burnaby', centre: { lat: 49.2488, lng: -122.9805 }, available: false },
  { name: 'Richmond', centre: { lat: 49.1666, lng: -123.1336 }, available: false },
  { name: 'Coquitlam', centre: { lat: 49.2838, lng: -122.7932 }, available: false },
  { name: 'Delta', centre: { lat: 49.0847, lng: -123.0587 }, available: false },
  { name: 'North Vancouver', centre: { lat: 49.3165, lng: -123.0688 }, available: false },
  { name: 'New Westminster', centre: { lat: 49.2057, lng: -122.911 }, available: false },
  { name: 'West Vancouver', centre: { lat: 49.3286, lng: -123.1602 }, available: false },
  { name: 'Port Moody', centre: { lat: 49.2849, lng: -122.8678 }, available: false },
]

export const DEFAULT_CITY = CITIES[0]!

// Same box the pipeline uses for "in Vancouver" (t311_pipeline.py). Checking the nearest city centre
// instead would put east Vancouver in Burnaby.
export function inVancouver(p: LatLng) {
  return p.lat >= 49.19 && p.lat <= 49.32 && p.lng >= -123.27 && p.lng <= -123.02
}

export function distanceKm(a: LatLng, b: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export function formatKm(km: number) {
  const m = Math.round((km * 1000) / 50) * 50
  return m < 1000 ? `${m} m` : `${km.toFixed(1)} km`
}

// undefined if the item has no place
export function distanceTo(from: LatLng, item: { lat?: number; lng?: number }) {
  return item.lat === undefined || item.lng === undefined ? undefined : distanceKm(from, { lat: item.lat, lng: item.lng })
}
