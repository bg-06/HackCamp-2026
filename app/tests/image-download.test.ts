import assert from 'node:assert/strict'
import test from 'node:test'
import { downloadVolunteerImage } from '../lib/volunteer-sources/image-download.js'

const mebibyte = 1024 * 1024

test('downloads an allowed image with safe request options', async () => {
  let request: { input: string | URL; init?: RequestInit } | undefined
  const fetchImage = async (input: string | URL, init?: RequestInit) => {
    request = { input, init }
    return new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/jpeg; charset=binary', 'content-length': '3' },
    })
  }

  const image = await downloadVolunteerImage('https://images.example/photo.jpg', fetchImage)
  assert.equal(image.mimeType, 'image/jpeg')
  assert.deepEqual([...image.data], [1, 2, 3])
  assert.equal(request?.init?.credentials, 'omit')
  assert.match(new Headers(request?.init?.headers).get('user-agent') ?? '', /BlockByBlock-Volunteer-Indexer/)
})

test('rejects unsafe URLs, credentials, and unsupported content types', async () => {
  const unusedFetch = async () => { throw new Error('fetch should not run') }
  await assert.rejects(downloadVolunteerImage('file:///tmp/photo.jpg', unusedFetch), /http or https/)
  await assert.rejects(downloadVolunteerImage('https://user:pass@example.com/photo.jpg', unusedFetch), /credentials/)
  await assert.rejects(
    downloadVolunteerImage('https://example.com/photo', async () => new Response('not an image', { headers: { 'content-type': 'text/html' } })),
    /unsupported image content type/,
  )
})

test('rejects oversized content-length before reading the body', async () => {
  const response = new Response(new Uint8Array([1]), {
    headers: { 'content-type': 'image/png', 'content-length': String(10 * mebibyte + 1) },
  })
  await assert.rejects(downloadVolunteerImage('https://example.com/photo.png', async () => response), /10 MiB/)
})

test('rejects a streamed body that exceeds the size limit', async () => {
  const chunk = new Uint8Array(6 * mebibyte)
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(chunk)
      controller.enqueue(chunk)
      controller.close()
    },
  })
  const response = new Response(body, { headers: { 'content-type': 'image/webp' } })
  await assert.rejects(downloadVolunteerImage('https://example.com/photo.webp', async () => response), /10 MiB/)
})
