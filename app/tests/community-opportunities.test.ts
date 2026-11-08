import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCommunityOpportunity } from '../lib/volunteer-sources/community-opportunities.js'
import type { VolunteerListing } from '../lib/volunteer-sources/types.js'

const listing: Omit<VolunteerListing, 'source'> = {
  sourceKey: 'test',
  kind: 'org',
  title: 'Test volunteer role',
  organiser: 'Test Org',
  category: 'Food and Community',
  startsAt: null,
  endsAt: null,
  location: 'Vancouver',
  localArea: 'Vancouver',
  latitude: null,
  longitude: null,
  spotsTotal: null,
  whatToBring: null,
  signupUrl: 'https://example.org/apply',
}

const config = {
  id: 'test-source',
  pageUrl: 'https://example.org/volunteer',
  expected: [/Volunteer with us/i, /Applications open/i],
  listing,
}

test('publishes a configured opportunity only when all validation markers are present', () => {
  const snapshot = parseCommunityOpportunity('<html><body><h1>Volunteer with us</h1><p>Applications open now.</p></body></html>', config)
  assert.equal(snapshot.validated, true)
  assert.deepEqual(snapshot.listings, [{ ...listing, source: config.id }])
})

test('rejects a missing, redesigned, or error page', () => {
  assert.throws(
    () => parseCommunityOpportunity('<html><body><h1>Volunteer with us</h1></body></html>', config),
    /did not contain the expected volunteer opportunity/,
  )
})
