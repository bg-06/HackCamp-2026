import { ChevronLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getProfileDesign, PROFILE_COMPARISON_ENABLED, saveProfileDesign, type ProfileDesign } from '../lib/profileDesign'
import { useThemePref } from '../lib/theme'
import { ApiError } from '../api/client'
import { isValidName, tidyName, useAuth } from '../state/auth'

const BAD_NAME = 'Use 1–60 characters, without < or >.'

export default function SettingsPage() {
  const [theme, setTheme] = useThemePref()
  const { signedIn, name, rename } = useAuth()
  const [draft, setDraft] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const value = draft ?? name ?? ''

  async function saveName(e: FormEvent) {
    e.preventDefault()
    const fail = (message: string) => { setError(message); setStatus('error') }
    if (!isValidName(tidyName(value))) return fail(BAD_NAME)
    setStatus('saving')
    try {
      await rename(value)
      setDraft(null)
      setStatus('saved')
    } catch (err) {
      const code = err instanceof ApiError ? err.status : 0
      fail(code === 400 ? BAD_NAME : code === 401 ? 'Please sign in again, then save.' : "Couldn't save your name. Check your connection and try again.")
    }
  }

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
        {signedIn && (
          <section className="settings-section" aria-labelledby="name-heading">
            <h2 id="name-heading">Display name</h2>
            <p className="muted small">Shown on your comments and the events you host.</p>
            <form className="event-form" onSubmit={saveName}>
              <label>
                Name
                <input
                  value={value}
                  maxLength={60}
                  autoComplete="nickname"
                  onChange={(e) => { setDraft(e.target.value); setStatus('idle') }}
                />
              </label>
              <button type="submit" className="chip-button" disabled={status === 'saving' || !value.trim() || tidyName(value) === name}>
                {status === 'saving' ? 'Saving…' : 'Save name'}
              </button>
              <p className="muted small" role="status">
                {status === 'saved' ? 'Name updated.' : status === 'error' ? error : ''}
              </p>
            </form>
          </section>
        )}
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
