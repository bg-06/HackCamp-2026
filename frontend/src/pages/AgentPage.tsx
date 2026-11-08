import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dismissSuggestion, getBriefings, getSuggestions, type Briefing, type Suggestion } from '../api/client'
import { useAuth } from '../state/auth'

export default function AgentPage() {
  const { signedIn, ready } = useAuth()
  const [briefings, setBriefings] = useState<Briefing[] | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [area, setArea] = useState('')
  const [briefingError, setBriefingError] = useState(false)
  const [suggestionError, setSuggestionError] = useState(false)
  const [dismissError, setDismissError] = useState(false)
  const [busy, setBusy] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setBriefings(null); setBriefingError(false)
    getBriefings().then(rows => { if (active) setBriefings(rows) }).catch(() => { if (active) setBriefingError(true) })
    return () => { active = false }
  }, [reload])
  useEffect(() => {
    let active = true
    setSuggestions(null); setSuggestionError(false)
    if (signedIn) getSuggestions().then(rows => { if (active) setSuggestions(rows) }).catch(() => { if (active) setSuggestionError(true) })
    return () => { active = false }
  }, [signedIn, reload])
  const dismiss = useCallback(async (id: string) => {
    setBusy(id); setDismissError(false)
    try { await dismissSuggestion(id); setSuggestions(rows => rows?.filter(row => row.id !== id) ?? null) }
    catch { setDismissError(true) }
    finally { setBusy('') }
  }, [])
  const areas = [...new Set((briefings ?? []).map(b => b.localArea))].sort()
  const visible = (briefings ?? []).filter(b => !area || b.localArea === area)
  const retry = () => setReload(n => n + 1)
  return <div className="page">
    <header className="home-header"><div className="top-bar">
      <Link className="icon-button" to="/me" aria-label="Back to profile"><ChevronLeft size={24} /></Link>
      <h1 className="header-title">Community updates</h1><span aria-hidden="true" />
    </div></header>
    <main className="page-content community-page">
      <section aria-labelledby="briefings-heading">
        <h2 id="briefings-heading">Neighbourhood briefings</h2>
        <p className="muted small">Updates about places that need attention around Vancouver.</p>
        <label className="community-filter">Neighbourhood <select value={area} onChange={e => setArea(e.target.value)}><option value="">All neighbourhoods</option>{areas.map(a => <option key={a}>{a}</option>)}</select></label>
        {briefingError ? <div className="empty" role="alert"><p>Could not load community updates.</p><button className="chip-button" onClick={retry}>Try again</button></div> : !briefings ? <p className="muted" role="status">Loading updates…</p> : visible.length === 0 ? <p className="muted">{area ? 'No briefings for this neighbourhood.' : 'No briefings yet.'}</p> : visible.map(b => <article key={b.id} className="community-card"><p className="eyebrow">{b.localArea}{b.weekOf ? ` · Week of ${b.weekOf}` : ''}</p><h3>{b.title}</h3><p className="community-body">{b.body}</p></article>)}
      </section>
      <section className="community-suggestions" aria-labelledby="suggestions-heading">
        <h2 id="suggestions-heading">Organization suggestions</h2>
        {!ready ? <p className="muted" role="status">Checking sign-in…</p> : !signedIn ? <p className="muted">Sign in to see suggestions for your organization.</p> : suggestionError ? <div role="alert"><p className="muted">Could not load suggestions.</p><button className="chip-button" onClick={retry}>Try again</button></div> : !suggestions ? <p className="muted" role="status">Loading suggestions…</p> : suggestions.length === 0 ? <p className="muted">No pending suggestions for your approved organizations.</p> : suggestions.map(s => <article key={s.id} className="community-card"><p className="eyebrow">{s.org_name}</p><h3>{s.title}</h3><p className="community-body">{s.body}</p><div className="community-actions"><Link className="chip-button" to={`/volunteer/new?suggestion=${encodeURIComponent(s.id)}`}>Plan event</Link><button className="chip-button" disabled={!!busy} onClick={() => void dismiss(s.id)}>{busy === s.id ? 'Dismissing…' : 'Dismiss'}</button></div></article>)}
        {dismissError && <p className="form-error" role="alert">Could not dismiss the suggestion. Please try again.</p>}
      </section>
    </main>
  </div>
}
