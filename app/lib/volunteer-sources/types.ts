export type VolunteerListing = {
  source: string
  sourceKey: string
  kind: 'city' | 'org'
  title: string
  organiser: string
  category: string | null
  startsAt: string | null
  endsAt: string | null
  location: string | null
  localArea: string | null
  latitude: number | null
  longitude: number | null
  spotsTotal: number | null
  whatToBring: string | null
  signupUrl: string
}

export type VolunteerSourceAdapter = {
  id: string
  fetchListings(): Promise<VolunteerListing[]>
}
