// Restrict automatic matches to explicit civic addresses with a municipality.
export function geocodableAddress(location: string | null): string | null {
  if (!location) return null
  const address = location.split(' · ').at(-1)?.trim() ?? ''
  if (!/^\d+[a-z]?\s+[^,]+,\s*[^,]+/i.test(address)) return null
  return /\bBC\b/i.test(address) ? address : `${address}, BC`
}

export type Geocode = { latitude: number; longitude: number; matchedAddress: string; precision: string; score: number }

export async function geocodeAddress(address: string): Promise<Geocode | null> {
  const url = new URL('https://geocoder.api.gov.bc.ca/addresses.json')
  url.searchParams.set('addressString', address)
  url.searchParams.set('maxResults', '1')
  url.searchParams.set('outputSRS', '4326')
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`BC geocoder returned ${response.status}`)
  const data = await response.json() as { features?: Array<{ geometry?: { coordinates?: number[] }; properties?: { score?: number; matchPrecision?: string; fullAddress?: string } }> }
  const match = data.features?.[0], props = match?.properties
  const [longitude, latitude] = match?.geometry?.coordinates ?? []
  const municipality = address.split(',')[1]?.trim().toLowerCase()
  const matchedMunicipality = props?.fullAddress?.split(',').at(-2)?.trim().toLowerCase()
  if (!props || !props.fullAddress || !municipality || matchedMunicipality !== municipality ||
      !['CIVIC_NUMBER', 'UNIT'].includes(props.matchPrecision ?? '') || (props.score ?? 0) < 90 ||
      latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 48 || latitude > 50 || longitude < -124 || longitude > -121) return null
  return { latitude, longitude, matchedAddress: props.fullAddress, precision: props.matchPrecision!, score: props.score! }
}
