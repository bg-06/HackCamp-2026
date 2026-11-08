import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dismissSuggestion, getBriefings, getSuggestions, type Briefing, type Suggestion } from "../api/client";
import { useAuth } from "../state/auth";

export default function AgentPage() {
  const { signedIn } = useAuth();
  const [briefings, setBriefings] = useState<Briefing[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [area, setArea] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => { getBriefings().then(setBriefings).catch(() => setError("Could not load community updates.")); }, []);
  useEffect(() => {
    if (!signedIn) { setSuggestions(null); return; }
    let active = true;
    getSuggestions().then(rows => { if (active) setSuggestions(rows); }).catch(() => { if (active) setError("Could not load suggestions."); });
    return () => { active = false; };
  }, [signedIn]);
  async function dismiss(id: string) {
    setBusy(id); setError("");
    try { await dismissSuggestion(id); setSuggestions(rows => rows?.filter(row => row.id !== id) ?? null); }
    catch { setError("Could not dismiss the suggestion. Please try again."); }
    finally { setBusy(""); }
  }
  const areas = [...new Set((briefings ?? []).map(b => b.localArea))].sort();
  return <div className="page"><header className="simple-header"><h1>Community updates</h1></header><main className="page-content">
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="detail-section"><h2>Neighbourhood briefings</h2>
      <label>Neighbourhood <select value={area} onChange={e => setArea(e.target.value)}><option value="">All neighbourhoods</option>{areas.map(a => <option key={a}>{a}</option>)}</select></label>
      {!briefings ? <p>Loading updates…</p> : briefings.filter(b => !area || b.localArea === area).map(b => <article key={b.id} className="detail-section"><h3>{b.title}</h3><p className="muted">{b.localArea}{b.weekOf ? ` · Week of ${b.weekOf}` : ""}</p><p style={{ whiteSpace: "pre-wrap" }}>{b.body}</p></article>)}
      {briefings?.length === 0 && <p className="muted">No briefings yet.</p>}
    </section>
    {signedIn && <section className="detail-section"><h2>Organization suggestions</h2>
      {!suggestions ? <p>Loading suggestions…</p> : suggestions.length === 0 ? <p className="muted">No pending suggestions for your approved organizations.</p> : suggestions.map(s => <article key={s.id} className="detail-section"><h3>{s.title}</h3><p className="muted">{s.org_name}</p><p style={{ whiteSpace: "pre-wrap" }}>{s.body}</p><Link className="chip-button" to={`/volunteer/new?suggestion=${encodeURIComponent(s.id)}`}>Plan event</Link>{" "}<button className="chip-button" disabled={!!busy} onClick={() => void dismiss(s.id)}>{busy === s.id ? "Dismissing…" : "Dismiss"}</button></article>)}
    </section>}
    {!signedIn && <p className="muted">Sign in to see suggestions for your organization.</p>}
  </main></div>;
}
