import { load } from 'cheerio'

export type RawVolunteerRecord = {
  source: string
  sourceKey: string
  recordType: 'upcoming_event' | 'ongoing_opportunity' | 'completed_activity'
  title: string
  organiser: string
  startsAt: string | null
  endsAt: string | null
  location: string | null
  municipality: string | null
  category: string | null
  signupUrl: string | null
  sourceUrl: string
  publishedAt: string | null
  rawRecord: unknown
}

type WordPressPost = {
  id: number
  date_gmt?: string
  link: string
  slug: string
  title: { rendered: string }
  content: { rendered: string }
}

function cleanHtml(html: string): string {
  return load(`<body>${html}</body>`)('body').text().replace(/\s+/g, ' ').trim()
}

function municipality(title: string): string | null {
  const match = title.match(/,\s*([^,]+)$/)
  return match?.[1]?.trim() ?? null
}

function location(title: string): string | null {
  const match = title.match(/\bat\s+(.+?)(?:,\s*[^,]+)?$/i)
  return match?.[1]?.trim() ?? null
}

function category(title: string): string {
  if (/litter|clean[ -]?up/i.test(title)) return 'Garbage and Dumping'
  return 'Parks and Trees'
}

export class GreenTeamsActivitiesAdapter {
  readonly id = 'green-teams-canada-activities'
  private readonly endpoint = 'https://greenteamscanada.ca/wp-json/wp/v2/posts'

  async fetchRecords(): Promise<RawVolunteerRecord[]> {
    const target = new URL(this.endpoint)
    target.searchParams.set('per_page', '100')
    target.searchParams.set('_fields', 'id,date_gmt,link,slug,title,content')
    const response = await fetch(target, {
      headers: { 'user-agent': 'BlockByBlock-Volunteer-Indexer/1.0 (+https://github.com/bg-06/HackCamp-2026)' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`${this.id}: ${response.status} ${response.statusText}`)
    const posts = await response.json() as WordPressPost[]

    return posts.map((post) => {
      const title = cleanHtml(post.title.rendered)
      const content = cleanHtml(post.content.rendered)
      const corpus = `${title} ${content}`
      const explicitlyVictoria = /Greater Victoria Green Team|Vancouver Island|Victoria|Colwood|Langford|Saanich|View Royal|Esquimalt/i.test(corpus)
      const explicitlyLowerMainland = /Lower Mainland Green Team|\bBurnaby\b|\bRichmond\b|\bSurrey\b|\bLangley\b|\bWhite Rock\b|\bNew Westminster\b|\bCoquitlam\b/i.test(corpus)
      const organiser = explicitlyLowerMainland && !explicitlyVictoria
        ? 'Lower Mainland Green Team'
        : explicitlyVictoria
          ? 'Greater Victoria Green Team'
          : 'Green Teams of Canada'
      return {
        source: this.id,
        sourceKey: String(post.id),
        recordType: 'completed_activity' as const,
        title,
        organiser,
        startsAt: null,
        endsAt: null,
        location: location(title),
        municipality: municipality(title),
        category: category(title),
        signupUrl: null,
        sourceUrl: post.link,
        publishedAt: post.date_gmt ? `${post.date_gmt}Z` : null,
        rawRecord: post,
      }
    })
  }
}
