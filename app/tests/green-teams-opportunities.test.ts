import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLowerMainlandOpportunity } from '../lib/volunteer-sources/green-teams-opportunities.js'

const source = 'green-teams-test'

const validHtml = `
  <html><body>
    <h1>Lower Mainland Green Team</h1>
    <p>The Lower Mainland Green Team is a program of Green Teams of Canada and connects people to nature.</p>
    <a href="https://www.meetup.com/The-Lower-Mainland-Green-Team/">JOIN Our Green Team!</a>
  </body></html>`

test('parses the official ongoing Lower Mainland opportunity', () => {
  const snapshot = parseLowerMainlandOpportunity(validHtml, source)
  assert.equal(snapshot.validated, true)
  assert.equal(snapshot.listings.length, 1)
  assert.deepEqual(snapshot.listings[0], {
    source,
    sourceKey: 'lower-mainland-green-team',
    kind: 'org',
    title: 'Join the Lower Mainland Green Team',
    organiser: 'Lower Mainland Green Team',
    category: 'Parks and Trees',
    startsAt: null,
    endsAt: null,
    location: 'Lower Mainland, BC',
    localArea: null,
    latitude: null,
    longitude: null,
    spotsTotal: null,
    whatToBring: 'Join hands-on environmental activities including habitat restoration, planting and litter cleanups.',
    signupUrl: 'https://www.meetup.com/The-Lower-Mainland-Green-Team/',
    imageSourceUrl: 'https://greenteamscanada.ca/wp-content/uploads/2023/11/GT-get-involved-1024x271.jpg',
    imageAttribution: 'Green Teams of Canada',
    imageLicense: null,
  })
})

test('rejects a changed page instead of publishing an unverified opportunity', () => {
  assert.throws(
    () => parseLowerMainlandOpportunity('<html><body><h1>Lower Mainland Green Team</h1></body></html>', source),
    /did not contain the expected Lower Mainland signup opportunity/,
  )
})
