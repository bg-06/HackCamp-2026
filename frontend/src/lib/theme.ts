import { useState } from 'react'

// Light, dark, or follow the phone's setting. Stored per browser; it's only a display preference.
export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'bbb-theme'

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

// "system" leaves html without data-theme, so the CSS media query decides.
export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
}

export function useThemePref() {
  const [pref, setPref] = useState<ThemePref>(readThemePref)
  function choose(next: ThemePref) {
    setPref(next)
    applyThemePref(next)
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      // storage blocked: the choice still holds for this visit
    }
  }
  return [pref, choose] as const
}
