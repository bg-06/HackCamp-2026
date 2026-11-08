export type ProfileDesign = 'original' | 'suggestion'

// Visitors get the new design by default; Settings still offers the comparison.
export const PROFILE_COMPARISON_ENABLED = true
export const DEFAULT_PROFILE_DESIGN: ProfileDesign = 'suggestion'
const STORAGE_KEY = 'bbb-profile-design'

export function getProfileDesign(): ProfileDesign {
  if (!PROFILE_COMPARISON_ENABLED) return DEFAULT_PROFILE_DESIGN
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'original' || stored === 'suggestion' ? stored : DEFAULT_PROFILE_DESIGN
  } catch {
    return DEFAULT_PROFILE_DESIGN
  }
}

export function saveProfileDesign(design: ProfileDesign) {
  try { localStorage.setItem(STORAGE_KEY, design) } catch { /* The setting lasts for this page only. */ }
}
