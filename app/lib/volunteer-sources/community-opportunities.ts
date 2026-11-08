import { load } from 'cheerio'
import type { VolunteerListing, VolunteerSnapshot, VolunteerSourceAdapter } from './types.js'

const USER_AGENT = 'GreenHandsBC-Volunteer-Indexer/1.0 (+https://github.com/bg-06/HackCamp-2026)'

type OpportunityConfig = {
  id: string
  pageUrl: string
  expected: RegExp[]
  listing: Omit<VolunteerListing, 'source'>
}

export function parseCommunityOpportunity(html: string, config: OpportunityConfig): VolunteerSnapshot {
  const $ = load(html)
  const text = $('body').text().replace(/\s+/g, ' ').trim()
  if (config.expected.some((pattern) => !pattern.test(text))) {
    throw new Error(`${config.id}: official page did not contain the expected volunteer opportunity`)
  }
  return { listings: [{ ...config.listing, source: config.id }], validated: true }
}

export class CommunityOpportunityAdapter implements VolunteerSourceAdapter {
  readonly id: string

  constructor(private readonly config: OpportunityConfig) {
    this.id = config.id
  }

  async fetchListings(): Promise<VolunteerSnapshot> {
    const response = await fetch(this.config.pageUrl, {
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`${this.id}: ${response.status} ${response.statusText}`)
    return parseCommunityOpportunity(await response.text(), this.config)
  }
}

export const communityOpportunitySources: VolunteerSourceAdapter[] = [
  new CommunityOpportunityAdapter({
    id: 'stanley-park-ecology-volunteers',
    pageUrl: 'https://stanleyparkecology.ca/about-stanley-park-ecology/volunteer/',
    expected: [/Volunteering with Stanley Park Ecology/i, /Applications open/i, /Volunteer Interest Form/i],
    listing: {
      sourceKey: 'stanley-park-volunteer-programs',
      kind: 'org',
      title: 'Volunteer with Stanley Park Ecology',
      organiser: 'Stanley Park Ecology',
      category: 'Parks and Trees',
      startsAt: null,
      endsAt: null,
      location: 'Stanley Park',
      localArea: 'West End',
      latitude: 49.3043,
      longitude: -123.1443,
      spotsTotal: null,
      whatToBring: 'Choose from ecological restoration, wildlife monitoring, education and other seasonal roles.',
      signupUrl: 'https://forms.office.com/r/68Y2g6nbcf',
      imageSourceUrl: 'https://stanleyparkecology.ca/wp-content/uploads/2025/02/C7A8BBD1-20D2-4999-9D26-7089E049515A-1-scaled.jpg',
      imageAttribution: 'Stanley Park Ecology',
      imageLicense: null,
    },
  }),
  new CommunityOpportunityAdapter({
    id: 'food-stash-volunteers',
    pageUrl: 'https://foodstash.ca/volunteer/',
    expected: [/Volunteer with us/i, /Food Sorting/i, /Food Boxing/i],
    listing: {
      sourceKey: 'food-stash-individual-volunteer',
      kind: 'org',
      title: 'Sort and pack rescued food',
      organiser: 'Food Stash Foundation',
      category: 'Food and Community',
      startsAt: null,
      endsAt: null,
      location: '290 E 1st Ave',
      localArea: 'Mount Pleasant',
      latitude: 49.2684,
      longitude: -123.0983,
      spotsTotal: null,
      whatToBring: 'Help sort rescued food, assemble food boxes or facilitate the rescued food market.',
      signupUrl: 'https://form-can.keela.co/volunteer-form4',
      imageSourceUrl: 'https://images.squarespace-cdn.com/content/v1/5bd8b1c31137a631121dad8f/1704919257485-OZ984K5AKI46GB22KYQA/Volunteer_img+%281%29.jpg',
      imageAttribution: 'Food Stash Foundation',
      imageLicense: null,
    },
  }),
  new CommunityOpportunityAdapter({
    id: 'vancouver-food-runners-volunteers',
    pageUrl: 'https://vancouverfoodrunners.com/volunteer-with-us',
    expected: [/Become a Food Rescue Hero/i, /claim a food rescue/i, /Volunteer on your own schedule/i],
    listing: {
      sourceKey: 'food-rescue-hero',
      kind: 'org',
      title: 'Become a Food Rescue Hero',
      organiser: 'Vancouver Food Runners',
      category: 'Food and Community',
      startsAt: null,
      endsAt: null,
      location: 'Across Metro Vancouver',
      localArea: 'Vancouver',
      latitude: null,
      longitude: null,
      spotsTotal: null,
      whatToBring: 'Use the free app to claim one-time or recurring surplus-food deliveries that fit your schedule.',
      signupUrl: 'https://vancouverfoodrunners.com/volunteer-with-us',
      imageSourceUrl: 'https://cdn.prod.website-files.com/6748960f247a9c474f4b89ab/67c89e216914a3755a1529f2_Marianne2-p-800.jpeg',
      imageAttribution: 'Vancouver Food Runners',
      imageLicense: null,
    },
  }),
  new CommunityOpportunityAdapter({
    id: 'vokra-volunteers',
    pageUrl: 'https://www.vokra.ca/volunteer',
    expected: [/Current Volunteering positions available/i, /Apply to Volunteer/i, /East Vancouver/i],
    listing: {
      sourceKey: 'current-volunteer-positions',
      kind: 'org',
      title: 'Help rescue and care for cats',
      organiser: 'VOKRA',
      category: 'Animals',
      startsAt: null,
      endsAt: null,
      location: 'East Vancouver and remote roles',
      localArea: 'East Vancouver',
      latitude: null,
      longitude: null,
      spotsTotal: null,
      whatToBring: 'Choose from cat care, driving, adoption support, fostering support, events, administration and other current roles.',
      signupUrl: 'https://app.betterimpact.com/Application?ApplicationFormNumber=1&OrganizationGuid=3ea59594-da40-4450-9fd4-448a668abbec',
      imageSourceUrl: 'https://images.squarespace-cdn.com/content/v1/5bbba72a2727be42cf12b47a/1574018947170-WHNDS13ZUDVBU279D9X5/_MG_7585.jpg',
      imageAttribution: 'Vancouver Orphan Kitten Rescue Association',
      imageLicense: null,
    },
  }),
  new CommunityOpportunityAdapter({
    id: 'bc-spca-volunteers',
    pageUrl: 'https://spca.bc.ca/ways-to-help/volunteer/',
    expected: [/How you can help at the BC SPCA/i, /How to become a volunteer/i, /current opportunities/i],
    listing: {
      sourceKey: 'vancouver-volunteer-opportunities',
      kind: 'org',
      title: 'Volunteer with the BC SPCA',
      organiser: 'BC SPCA',
      category: 'Animals',
      startsAt: null,
      endsAt: null,
      location: 'Vancouver and across BC',
      localArea: 'Vancouver',
      latitude: null,
      longitude: null,
      spotsTotal: null,
      whatToBring: 'Search current roles in animal care, transport, administration, outreach, fostering and community services.',
      signupUrl: 'https://app.betterimpact.com/PublicEnterprise/3daf2b99-02b2-461d-872b-54cc0a82eaf8',
      imageSourceUrl: 'https://spca.bc.ca/wp-content/uploads/volunteer-mother-teen-holding-puppy-outdoors-20.jpg',
      imageAttribution: 'BC SPCA',
      imageLicense: null,
    },
  }),
  new CommunityOpportunityAdapter({
    id: 'success-volunteers',
    pageUrl: 'https://successbc.ca/get-involved/volunteer/',
    expected: [/S\.U\.C\.C\.E\.S\.S\. values the thousands of people/i, /Volunteer Opportunities/i, /View and Apply for Current Opportunities/i],
    listing: {
      sourceKey: 'current-opportunities',
      kind: 'org',
      title: 'Volunteer with S.U.C.C.E.S.S.',
      organiser: 'S.U.C.C.E.S.S.',
      category: 'Food and Community',
      startsAt: null,
      endsAt: null,
      location: 'Vancouver and the Lower Mainland',
      localArea: 'Vancouver',
      latitude: null,
      longitude: null,
      spotsTotal: null,
      whatToBring: 'Browse current roles supporting seniors, newcomers, events, mentoring, tax clinics and community programs.',
      signupUrl: 'https://app.betterimpact.com/PublicEnterprise/c2ee653d-cda4-44e8-892e-25e1f885f432',
      imageSourceUrl: 'https://successbc.ca/wp-content/uploads/2020/06/iStock-871518164_resized-768x512.jpg',
      imageAttribution: 'S.U.C.C.E.S.S.',
      imageLicense: null,
    },
  }),
  new CommunityOpportunityAdapter({
    id: 'spec-repair-cafe-volunteers',
    pageUrl: 'https://spec.bc.ca/repair-cafe/volunteer/',
    expected: [/Volunteers are integral to Repair Cafés/i, /How to Volunteer/i, /Apply to volunteer here/i],
    listing: {
      sourceKey: 'repair-cafe-volunteers',
      kind: 'org',
      title: 'Volunteer at a Repair Café',
      organiser: 'SPEC',
      category: 'Food and Community',
      startsAt: null,
      endsAt: null,
      location: 'Vancouver',
      localArea: 'Kitsilano',
      latitude: null,
      longitude: null,
      spotsTotal: null,
      whatToBring: 'Help with check-in, event support, repairs, sewing, electronics, bikes or learn as an apprentice fixer.',
      signupUrl: 'https://form-can.keela.co/repair-cafe-volunteer-application-form',
      imageSourceUrl: 'https://spec.bc.ca/wp-content/uploads/2023/02/Copy-of-Repair-Cafe-Banner-1024x512.png',
      imageAttribution: 'Society Promoting Environmental Conservation',
      imageLicense: null,
    },
  }),
  new CommunityOpportunityAdapter({
    id: 'greater-vancouver-food-bank-volunteers',
    pageUrl: 'https://www.foodbank.bc.ca/volunteer/',
    expected: [/Volunteers are the heart of the GVFB/i, /Group applications/i, /Application Process/i],
    listing: {
      sourceKey: 'group-volunteers',
      kind: 'org',
      title: 'Volunteer with the Greater Vancouver Food Bank',
      organiser: 'Greater Vancouver Food Bank',
      category: 'Food and Community',
      startsAt: null,
      endsAt: null,
      location: 'Vancouver and Burnaby',
      localArea: 'Vancouver',
      latitude: null,
      longitude: null,
      spotsTotal: null,
      whatToBring: 'Apply for group opportunities supporting food distribution and warehouse operations.',
      signupUrl: 'https://app.betterimpact.com/Application?OrganizationGuid=761b1b0c-2275-482e-ba47-108eceafa2d8&ApplicationFormNumber=2',
      imageSourceUrl: 'https://foodbank.bc.ca/wp-content/uploads/2022/09/gvfb-volunteer.jpg',
      imageAttribution: 'Greater Vancouver Food Bank',
      imageLicense: null,
    },
  }),
]
