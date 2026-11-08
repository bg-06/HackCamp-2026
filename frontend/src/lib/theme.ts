import { useEffect, useState } from 'react'

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
const BAR = { light: '#ffffff', dark: '#111112' } // the phone's status bar, matching --bg

export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref

  // Two theme-color tags, one per system setting. On Auto they keep their own colours;
  // with a pick, both get the picked colour so the status bar matches the app.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const own = meta.media.includes('dark') ? BAR.dark : BAR.light
    meta.content = pref === 'system' ? own : BAR[pref]
  })
}

// Which theme is actually showing: the person's pick, or the system's when they left it on Auto.
function resolvedDark() {
  const picked = document.documentElement.dataset.theme
  if (picked) return picked === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

// For things CSS can't restyle (the map). Updates when the system setting or the pick changes.
export function useIsDark() {
  const [dark, setDark] = useState(resolvedDark)
  useEffect(() => {
    const update = () => setDark(resolvedDark())
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    media?.addEventListener('change', update)
    const watcher = new MutationObserver(update)
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      media?.removeEventListener('change', update)
      watcher.disconnect()
    }
  }, [])
  return dark
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
