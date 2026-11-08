import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getProfileDesign, PROFILE_COMPARISON_ENABLED, saveProfileDesign, type ProfileDesign } from '../lib/profileDesign'
import { useThemePref } from '../lib/theme'

export default function SettingsPage() {
  const [theme, setTheme] = useThemePref()
  const [design, setDesign] = useState<ProfileDesign>(getProfileDesign)

  function chooseDesign(next: ProfileDesign) {
    setDesign(next)
    saveProfileDesign(next)
  }

  return (
    <div className="page">
      <header className="home-header">
        <div className="top-bar">
          <Link className="icon-button" to="/me" aria-label="Back to profile"><ChevronLeft size={24} /></Link>
          <h1 className="header-title">Settings</h1>
          <span aria-hidden="true" />
        </div>
      </header>
      <main className="page-content">
        <section className="settings-section" aria-labelledby="appearance-heading">
          <h2 id="appearance-heading">Appearance</h2>
          <p className="muted small">Choose a theme or follow your device.</p>
          <div className="place-actions" role="group" aria-label="Appearance">
            {(['system', 'light', 'dark'] as const).map((option) => (
              <button key={option} type="button" className="chip-button" aria-pressed={theme === option} onClick={() => setTheme(option)}>
                {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </section>
        {PROFILE_COMPARISON_ENABLED && (
          <section className="settings-section" aria-labelledby="profile-design-heading">
            <h2 id="profile-design-heading">Profile design</h2>
            <p className="muted small">Switch between the two designs to compare them.</p>
            <div className="place-actions" role="group" aria-label="Profile design">
              <button type="button" className="chip-button" aria-pressed={design === 'original'} onClick={() => chooseDesign('original')}>Original</button>
              <button type="button" className="chip-button" aria-pressed={design === 'suggestion'} onClick={() => chooseDesign('suggestion')}>New</button>
            </div>
            <Link className="text-link" to="/me">View profile →</Link>
          </section>
        )}
      </main>
    </div>
  )
}
