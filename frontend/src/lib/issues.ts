import type { Track2Issue } from '../types'

export const VAN311_URL = 'https://vancouver.ca/van311.aspx'

// Same formula as the API and gold.issue_priority: base_score + 3 per up vote, the current user's included.
export function issueScore(issue: Track2Issue) {
  const up = issue.up_votes + issue.my_vote
  return { up, score: issue.base_score + 3 * up }
}
