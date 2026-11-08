import type { LatLng } from '../types'

// Only City of Vancouver data so far. The centre is City Hall, used for distances when "Near me" is off.
export const CITY = { name: 'Vancouver', centre: { lat: 49.2606, lng: -123.114 } }

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
