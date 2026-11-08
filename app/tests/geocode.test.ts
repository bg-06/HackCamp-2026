import assert from 'node:assert/strict'
import test from 'node:test'
import { geocodableAddress, geocodeAddress } from '../lib/volunteer-sources/geocode.js'

test('only specific civic addresses with a municipality are sent for geocoding', () => {
  assert.equal(geocodableAddress('Ruth Johnson Park · 14600 North Bluff Rd, White Rock, BC'), '14600 North Bluff Rd, White Rock, BC')
  assert.equal(geocodableAddress('Across Metro Vancouver'), null)
  assert.equal(geocodableAddress('290 E 1st Ave'), null)
})

test('accepts only high confidence civic matches in the requested municipality', async () => {
  const original = globalThis.fetch
  let precision = 'CIVIC_NUMBER', fullAddress = '14600 North Bluff Rd, White Rock, BC'
  globalThis.fetch = async () => new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-122.8, 49.02] }, properties: { score: 99, matchPrecision: precision, fullAddress } }] }))
  try {
    assert.equal((await geocodeAddress('14600 North Bluff Rd, White Rock, BC'))?.latitude, 49.02)
    precision = 'LOCALITY'
    assert.equal(await geocodeAddress('14600 North Bluff Rd, White Rock, BC'), null)
    precision = 'CIVIC_NUMBER'; fullAddress = '14600 North Bluff Rd, Surrey, BC'
    assert.equal(await geocodeAddress('14600 North Bluff Rd, White Rock, BC'), null)
  } finally { globalThis.fetch = original }
})
