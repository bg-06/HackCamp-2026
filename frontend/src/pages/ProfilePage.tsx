import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyHistory, USE_MOCK } from "../api/client";
import { downloadHoursRecord, formatDay, formatHours } from "../lib/hours";
import { useAuth } from "../state/auth";
import { useFeed } from "../state/feed";
import type { VolunteerRecord } from "../types";

const TZ = "America/Vancouver";

export default function ProfilePage() {
  const { events, issues, signedIn, signIn, signOut } = useFeed();
  const { ready, name, picture, error: authError } = useAuth();
  const [history, setHistory] = useState<VolunteerRecord[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    getMyHistory()
      .then((h) => !cancelled && setHistory(h))
      .catch(() => !cancelled && setHistoryError(true));
    return () => {
      cancelled = true;
    };
  }, [reloadKey, signedIn]);

  const upcoming = (events.items ?? [])
    .filter((e) => e.going)
    .sort((a, b) => (a.startsAt ? Date.parse(a.startsAt) : Infinity) - (b.startsAt ? Date.parse(b.startsAt) : Infinity));
  const votes = (issues.items ?? []).filter((i) => i.my_vote !== 0);
  const totalHours = (history ?? []).reduce((n, r) => n + r.hours, 0);

  return (
    <div className="page">
      <header className="simple-header">
        <h1>Profile</h1>
      </header>

      <main className="page-content">
        <section className="profile-head">
          <span className="avatar" aria-hidden="true">
            {signedIn && picture ? (
              <img src={picture} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            ) : signedIn ? (
              (name ?? "Y").charAt(0).toUpperCase()
            ) : (
              "?"
            )}
          </span>
          <div className="profile-who">
            <p className="profile-name">{signedIn ? (name ?? "You") : ready ? "Not signed in" : "Checking sign-in…"}</p>
            <p className="muted small">Vancouver</p>
          </div>
          <button className={`action-button ${signedIn ? "secondary" : ""} profile-sign`} onClick={signedIn ? signOut : signIn} disabled={!ready}>
            {signedIn ? "Sign out" : "Sign in"}
          </button>
        </section>
        {authError && (
          <p className="form-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            {authError}
          </p>
        )}
        {USE_MOCK && (
          <p className="muted small">Sample sign-in for now, no real account. Shows sample history plus what you've done on this visit.</p>
        )}

        {!ready ? null : !signedIn ? (
          <p className="muted">Sign in to see what you've signed up for, your votes and your volunteer hours.</p>
        ) : (
          <>
            <dl className="stats">
              <div>
                <dt>Volunteer hours</dt>
                <dd>{history ? Number(totalHours.toFixed(1)) : "–"}</dd>
              </div>
              <div>
                <dt>Signed up</dt>
                <dd>{upcoming.length}</dd>
              </div>
              <div>
                <dt>Votes</dt>
                <dd>{votes.length}</dd>
              </div>
            </dl>
    
            <section className="detail-section" aria-labelledby="upcoming-heading">
              <h2 id="upcoming-heading">Coming up</h2>
              {upcoming.length === 0 ? (
                <p className="muted">
                  Nothing yet. <Link className="text-link" to="/">Find a way to help</Link>
                </p>
              ) : (
                <ul className="plain-list">
                  {upcoming.map((e) => (
                    <li key={e.id}>
                      <Link className="row-link" to={`/volunteer/${encodeURIComponent(e.id)}`}>
                        <span className="eyebrow">
                          {e.startsAt
                            ? new Date(e.startsAt).toLocaleDateString("en-CA", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" })
                            : "Ongoing"}
                        </span>
                        <span className="row-title">{e.title}</span>
                        <span className="muted small">{e.location}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
    
            <section className="detail-section" aria-labelledby="votes-heading">
              <h2 id="votes-heading">Your votes</h2>
              {votes.length === 0 ? (
                <p className="muted">
                  You haven't voted yet. <Link className="text-link" to="/issues">See what needs fixing</Link>
                </p>
              ) : (
                <ul className="plain-list">
                  {votes.map((i) => (
                    <li key={i.issue_id}>
                      <Link className="row-link with-mark" to={`/issues/${encodeURIComponent(i.issue_id)}`}>
                        <span className="vote-mark up" aria-label="Voted pressing">
                          ▲
                        </span>
                        <span>
                          <span className="row-title">{i.request_type.replace(/ Case$/, "")}</span>
                          <span className="muted small">{i.address ?? i.local_area}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
    
            <section className="detail-section" aria-labelledby="hours-heading">
              <h2 id="hours-heading">Volunteer hours</h2>
    
              {historyError && (
                <p className="form-error" role="alert">
                  <TriangleAlert size={16} aria-hidden="true" />
                  Couldn't load your hours.{" "}
                  <button
                    className="link-button"
                    onClick={() => {
                      setHistoryError(false);
                      setReloadKey((k) => k + 1);
                    }}
                  >
                    Try again
                  </button>
                </p>
              )}
    
              {history && history.length === 0 && <p className="muted">Hours show up here after an event you joined is marked done.</p>}
    
              {history && history.length > 0 && (
                <>
                  <ul className="plain-list">
                    {history.map((r) => (
                      <li key={r.id} className="hours-row">
                        <span>
                          <span className="eyebrow">{formatDay(r.date)}</span>
                          <span className="row-title">{r.title}</span>
                          <span className="muted small">{r.organiser}</span>
                        </span>
                        <span className="hours">{formatHours(r.hours)}</span>
                      </li>
                    ))}
                  </ul>
                  <button className="action-button secondary" onClick={() => downloadHoursRecord(history)}>
                    Download hours record
                  </button>
                  <p className="action-note">A CSV file you can print or send. Some schools ask for the organiser's signature too.</p>
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
