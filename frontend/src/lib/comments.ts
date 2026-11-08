import type { AuthorKind } from '../types'

// The badge next to an author's name. Residents get none; orgs and the agent are always labelled.
export const AUTHOR_BADGES: Record<AuthorKind, { label: string; className: string } | null> = {
  resident: null,
  org: { label: 'Local group', className: 'kind-org' },
  agent: { label: 'AI summary of City data', className: 'kind-agent' },
}

export const COMMENT_MAX = 1000

/** "just now", "12m ago", "3h ago", then "Nov 6". */
export function formatPosted(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver', month: 'short', day: 'numeric' })
}
