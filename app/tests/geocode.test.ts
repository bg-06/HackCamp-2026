import assert from 'node:assert/strict'
import test from 'node:test'
import { geocodableAddress, geocodeAddress } from '../lib/volunteer-sources/geocode.js'

test('only specific civic addresses with a municipality are sent for geocoding', () => {
  assert.equal(geocodableAddress('Ruth Johnson Park · 14600 North Bluff Rd, White Rock, BC'), '14600 North Bluff Rd, White Rock, BC')
  assert.equal(geocodableAddress('Across Metro Vancouver'), null)
  assert.equal(geocodableAddress('290 E 1st Ave'), null)
})

test('street intersections are geocoded only for events in a Vancouver local area', () => {
  assert.equal(geocodableAddress('Main St and E Broadway', true), 'Main St and E Broadway, Vancouver, BC')
  assert.equal(geocodableAddress('Main St & E Broadway', true), 'Main St and E Broadway, Vancouver, BC')
  assert.equal(geocodableAddress('Main St and E Broadway'), null)
  assert.equal(geocodableAddress('Vancouver and Burnaby', true), null)
  assert.equal(geocodableAddress('W 4th Ave and Yew St', true), 'W 4th Ave and Yew St, Vancouver, BC')
  assert.equal(geocodableAddress('Lane behind 300 block E Broadway', true), null)
})

test('intersection lookups accept only an exact intersection match', async () => {
  const original = globalThis.fetch
  let precision = 'INTERSECTION'
  globalThis.fetch = async () => new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-123.1009, 49.2629] }, properties: { score: 100, matchPrecision: precision, fullAddress: 'E Broadway and Main St, Vancouver, BC' } }] }))
  try {
    assert.equal((await geocodeAddress('Main St and E Broadway, Vancouver, BC'))?.precision, 'INTERSECTION')
    precision = 'STREET'
    assert.equal(await geocodeAddress('Main St and E Broadway, Vancouver, BC'), null)
    precision = 'INTERSECTION'
    assert.equal(await geocodeAddress('14600 North Bluff Rd, White Rock, BC'), null)
  } finally { globalThis.fetch = original }
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
