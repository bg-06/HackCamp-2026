import type { Track2Issue } from '../types'

export const VAN311_URL = 'https://vancouver.ca/van311.aspx'

// New up votes each person gets per Vancouver day (the API's limit). Use the budget's dailyLimit when you have it.
export const DAILY_VOTES = 2

// Today in Vancouver as YYYY-MM-DD, the same format as VoteBudget.voteDate.
export const vancouverToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' })

// Same formula as the API and gold.issue_priority: base_score + 3 per up vote, the current user's included.
export function issueScore(issue: Track2Issue) {
  const up = issue.up_votes + issue.my_vote
  return { up, score: issue.base_score + 3 * up }
}
