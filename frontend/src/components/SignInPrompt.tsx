import { useEffect, useRef } from 'react'
import { USE_MOCK } from '../api/client'
import { useFeed } from '../state/feed'

// Shown when someone signed out tries to vote, sign up, comment or start an event.
// After signing in, the thing they tapped goes through.
export default function SignInPrompt() {
  const { signInPrompt, signIn, cancelSignIn } = useFeed()
  const signInButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!signInPrompt) return
    const opener = document.activeElement as HTMLElement | null
    signInButton.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelSignIn()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [signInPrompt, cancelSignIn])

  if (!signInPrompt) return null

  return (
    <div className="sheet-backdrop" onClick={cancelSignIn}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sign-in-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="sign-in-title" className="sheet-title">
          Sign in to {signInPrompt}
        </h2>
        <p className="muted">One account per person keeps votes fair and lets organisers know who's coming.</p>
        <div className="sheet-actions">
          <button ref={signInButton} className="action-button" onClick={signIn}>
            Sign in
          </button>
          <button className="action-button secondary" onClick={cancelSignIn}>
            Not now
          </button>
        </div>
        {USE_MOCK && <p className="muted small">Sample sign-in: no account needed yet.</p>}
      </div>
    </div>
  )
}
