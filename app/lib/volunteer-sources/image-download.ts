const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_USER_AGENT = 'GreenHandsBC-Volunteer-Indexer/1.0 (+https://github.com/bg-06/HackCamp-2026)'
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type DownloadedImage = {
  data: Uint8Array
  mimeType: string
}

type FetchImage = (input: string | URL, init?: RequestInit) => Promise<Response>

export async function downloadVolunteerImage(
  sourceUrl: string,
  fetchImage: FetchImage = fetch,
  timeoutMs = 15_000,
): Promise<DownloadedImage> {
  let url: URL
  try {
    url = new URL(sourceUrl)
  } catch {
    throw new Error('image URL is invalid')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('image URL must use http or https')
  }
  if (url.username || url.password) throw new Error('image URL must not contain credentials')

  const response = await fetchImage(url, {
    headers: {
      accept: 'image/jpeg,image/png,image/webp,image/gif',
      'user-agent': IMAGE_USER_AGENT,
    },
    redirect: 'follow',
    credentials: 'omit',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`image request returned ${response.status} ${response.statusText}`)

  const mimeType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (!mimeType || !ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error(`unsupported image content type: ${mimeType ?? 'missing'}`)
  }

  const contentLengthHeader = response.headers.get('content-length')
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader)
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) throw new Error('invalid image content-length')
    if (contentLength > MAX_IMAGE_BYTES) throw new Error('image exceeds 10 MiB limit')
  }
  if (!response.body) throw new Error('image response had no body')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      if (byteLength > MAX_IMAGE_BYTES) {
        await reader.cancel()
        throw new Error('image exceeds 10 MiB limit')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (byteLength === 0) throw new Error('image response was empty')

  const data = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { data, mimeType }
}
