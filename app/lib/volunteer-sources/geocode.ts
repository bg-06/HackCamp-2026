// Two named streets, like "Main St and E Broadway". Each side must end in a street type
// (or be Broadway), so regions like "Vancouver and Burnaby" don't count.
const STREET = /^[a-z0-9][a-z0-9 .']*(?:\s(?:St|Ave|Rd|Dr|Blvd|Way|Pl|Cres|Hwy|Mall)\.?(?:\s(?:E|W|N|S))?|\bBroadway)$/i
export function isIntersection(text: string): boolean {
  const sides = text.split(/\s(?:and|&)\s/i)
  return sides.length === 2 && sides.every(side => STREET.test(side.trim()))
}

// Restrict automatic matches to explicit civic addresses with a municipality, or to a
// street intersection when the event is in one of the City of Vancouver's local areas.
export function geocodableAddress(location: string | null, inVancouver = false): string | null {
  if (!location) return null
  const address = location.split(' · ').at(-1)?.trim() ?? ''
  if (inVancouver && isIntersection(address)) return `${address.replace(/\s&\s/, ' and ')}, Vancouver, BC`
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
  const precisions = isIntersection(address.split(',')[0] ?? '') ? ['INTERSECTION'] : ['CIVIC_NUMBER', 'UNIT']
  const matchedMunicipality = props?.fullAddress?.split(',').at(-2)?.trim().toLowerCase()
  if (!props || !props.fullAddress || !municipality || matchedMunicipality !== municipality ||
      !precisions.includes(props.matchPrecision ?? '') || (props.score ?? 0) < 90 ||
      latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 48 || latitude > 50 || longitude < -124 || longitude > -121) return null
  return { latitude, longitude, matchedAddress: props.fullAddress, precision: props.matchPrecision!, score: props.score! }
}
