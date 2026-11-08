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
  imageSourceUrl?: string
  imageAttribution?: string | null
  imageLicense?: string | null
}

export type VolunteerSnapshot = {
  listings: VolunteerListing[]
  validated: true
}

export type VolunteerSourceAdapter = {
  id: string
  fetchListings(): Promise<VolunteerSnapshot>
}
