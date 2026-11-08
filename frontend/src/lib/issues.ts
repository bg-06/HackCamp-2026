import type { Track2Issue } from '../types'

export const VAN311_URL = 'https://vancouver.ca/van311.aspx'

// Same formula as gold.issue_priority (plan.md 5.5), plus the current user's vote.
export function issueScore(issue: Track2Issue) {
  const up = issue.up_votes + (issue.my_vote === 1 ? 1 : 0)
  const down = issue.down_votes + (issue.my_vote === -1 ? 1 : 0)
  return { up, down, score: issue.base_score + 3 * (up - down) }
}
