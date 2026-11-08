import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMeetupListings } from '../lib/volunteer-sources/meetup.js'

const source = 'meetup-test'
const organiser = 'Test Green Team'

test('accepts a confirmed empty Events page', () => {
  const snapshot = parseMeetupListings('<html><body><h1>Events</h1><p>0 List</p></body></html>', source, organiser)
  assert.equal(snapshot.validated, true)
  assert.deepEqual(snapshot.listings, [])
})

test('rejects malformed or unrecognized HTML', () => {
  assert.throws(
    () => parseMeetupListings('<html><body><h1>Just a moment...</h1></body></html>', source, organiser),
    /did not contain event metadata/,
  )
})

test('parses active JSON-LD and filters ended events', () => {
  const html = `<html><body><h1>Events</h1><script type="application/ld+json">${JSON.stringify({
    '@graph': [
      { '@type': 'Event', name: 'Future cleanup', startDate: '2026-12-01T10:00:00-08:00', url: 'https://www.meetup.com/group/events/123/', image: 'https://images.example/future.jpg' },
      { '@type': 'Event', name: 'Past cleanup', startDate: '2026-01-01T10:00:00-08:00', endDate: '2026-01-01T12:00:00-08:00', url: 'https://www.meetup.com/group/events/456/' },
    ],
  })}</script></body></html>`
  const snapshot = parseMeetupListings(html, source, organiser, Date.parse('2026-11-08T00:00:00Z'))
  assert.equal(snapshot.listings.length, 1)
  assert.equal(snapshot.listings[0]?.sourceKey, '123')
  assert.equal(snapshot.listings[0]?.title, 'Future cleanup')
  assert.equal(snapshot.listings[0]?.imageSourceUrl, 'https://images.example/future.jpg')
  assert.equal(snapshot.listings[0]?.imageAttribution, organiser)
})

test('supports JSON-LD image arrays and ImageObject URL fields', () => {
  const events = [
    { sourceKey: '1', image: ['https://images.example/array.jpg'] },
    { sourceKey: '2', image: { url: 'https://images.example/url.jpg' } },
    { sourceKey: '3', image: { url: 'https://images.example/url.jpg', contentUrl: 'https://images.example/content.jpg' } },
  ]
  const html = `<html><body><script type="application/ld+json">${JSON.stringify(events.map((event) => ({
    '@type': 'Event',
    name: `Cleanup ${event.sourceKey}`,
    startDate: '2026-12-01T10:00:00-08:00',
    url: `https://www.meetup.com/group/events/${event.sourceKey}/`,
    image: event.image,
  })))}</script></body></html>`

  const snapshot = parseMeetupListings(html, source, organiser, Date.parse('2026-11-08T00:00:00Z'))
  assert.deepEqual(snapshot.listings.map((listing) => listing.imageSourceUrl), [
    'https://images.example/array.jpg',
    'https://images.example/url.jpg',
    'https://images.example/content.jpg',
  ])
})
