export type ProfileDesign = 'original' | 'suggestion'

// After the vote, set this to false and choose the winner below.
export const PROFILE_COMPARISON_ENABLED = true
export const DEFAULT_PROFILE_DESIGN: ProfileDesign = 'original'
const STORAGE_KEY = 'bbb-profile-design'

export function getProfileDesign(): ProfileDesign {
  if (!PROFILE_COMPARISON_ENABLED) return DEFAULT_PROFILE_DESIGN
  try {
    return localStorage.getItem(STORAGE_KEY) === 'suggestion' ? 'suggestion' : 'original'
  } catch {
    return DEFAULT_PROFILE_DESIGN
  }
}

export function saveProfileDesign(design: ProfileDesign) {
  try { localStorage.setItem(STORAGE_KEY, design) } catch { /* The setting lasts for this page only. */ }
}
