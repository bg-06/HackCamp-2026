import type { Track2Issue } from '../types'

// TODO(team): check this is the right Van311 link before the demo.
export const VAN311_URL = 'https://vancouver.ca/van311'

/** Live score, same formula as plan.md 5.5: base_score + 3 * (up - down). Counts the current user's vote. */
export function issueScore(issue: Track2Issue) {
  const up = issue.up_votes + (issue.my_vote === 1 ? 1 : 0)
  const down = issue.down_votes + (issue.my_vote === -1 ? 1 : 0)
  return { up, down, score: issue.base_score + 3 * (up - down) }
}
