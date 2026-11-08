export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }
export type ApiPage = { total_count: number; results: JsonObject[] }

export const VANCOUVER_API_ROOT = 'https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets'

export async function apiJson<T>(
  url: string,
  params: Record<string, string | number> = {},
  timeoutMs = 120_000,
): Promise<T> {
  const target = new URL(url)
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value))

  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(target, {
        headers: { 'user-agent': 'BlockByBlock-Ingest/1.0 (+https://github.com/bg-06/HackCamp-2026)' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${target}`)
      return await response.json() as T
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1_000))
    }
  }
  throw lastError
}

export async function recordPage(datasetId: string, offset: number, where?: string): Promise<ApiPage> {
  return apiJson<ApiPage>(`${VANCOUVER_API_ROOT}/${datasetId}/records`, {
    limit: 100,
    offset,
    ...(where ? { where } : {}),
  })
}

export async function allRecords(datasetId: string, where?: string): Promise<JsonObject[]> {
  const output: JsonObject[] = []
  for (let offset = 0; ; offset += 100) {
    const page = await recordPage(datasetId, offset, where)
    output.push(...page.results)
    if (!page.results.length || output.length >= page.total_count) return output
  }
}
