import {
  Bookmark,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Clock,
  HeartHandshake,
  LogIn,
  LogOut,
  MapPin,
  Settings,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { getMyHistory, USE_MOCK } from "../api/client";
import { downloadHoursRecord, formatDay, formatHours } from "../lib/hours";
import { useAuth } from "../state/auth";
import { useFeed } from "../state/feed";
import type { VolunteerRecord } from "../types";

const TZ = "America/Vancouver";

type Section = "upcoming" | "votes" | "hours";

// One tappable row (icon, label, count, chevron) that opens its list under it.
function ListRow(props: { icon: ReactNode; label: string; count: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  const { icon, label, count, open, onToggle, children } = props;
  return (
    <li className="list-row">
      <button className="list-row-head" aria-expanded={open} onClick={onToggle}>
        <span className="list-row-icon">{icon}</span>
        <span className="list-row-label">{label}</span>
        <span className="list-row-count">{count}</span>
        <ChevronRight size={22} className={`list-row-chevron ${open ? "open" : ""}`} aria-hidden="true" />
      </button>
      {open && <div className="list-row-body">{children}</div>}
    </li>
  );
}

export default function SuggestionProfilePage() {
  const { events, issues, signedIn, signIn, signOut } = useFeed();
  const { ready, name, picture, error: authError } = useAuth();
  const [history, setHistory] = useState<VolunteerRecord[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState<Section | null>(null);

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
  const next = upcoming[0];
  const toggle = (s: Section) => setOpen(open === s ? null : s);

  const displayName = signedIn ? (name ?? "You") : ready ? "Not signed in" : "Checking sign-in…";
  const initials = signedIn
    ? (name ?? "You")
        .split(/\s+/)
        .map((w) => w.charAt(0))
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className="page place">
      <header className="profile-bar">
        <h1>{displayName}</h1>
        <Link className="icon-button plain" to="/settings" aria-label="Settings"><Settings size={24} /></Link>
        <button className="icon-button plain" onClick={signedIn ? signOut : signIn} disabled={!ready} aria-label={signedIn ? "Sign out" : "Sign in"}>
          {signedIn ? <LogOut size={24} /> : <LogIn size={24} />}
        </button>
      </header>

      <main className="page-content">
        <Link className="community-link" to="/community-updates">Community updates <span aria-hidden="true">→</span></Link>
        <section className="profile-hero">
          <span className="avatar-xl" aria-hidden="true">
            {signedIn && picture ? <img src={picture} alt="" referrerPolicy="no-referrer" /> : initials}
          </span>
          <p className="profile-handle">{signedIn ? `@${(name ?? "you").replace(/\s+/g, "")}` : "GreenHands BC"}</p>
          <p className="profile-since">Neighbour in Vancouver</p>
          <p className="profile-badge">
            <MapPin size={20} aria-hidden="true" />
            Vancouver, BC
          </p>
        </section>

        {authError && (
          <p className="form-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            {authError}
          </p>
        )}

        <dl className="stats">
          <div>
            <dt>Hours</dt>
            <dd>{signedIn && history ? Number(totalHours.toFixed(1)) : "–"}</dd>
          </div>
          <div>
            <dt>Signed up</dt>
            <dd>{signedIn ? upcoming.length : "–"}</dd>
          </div>
          <div>
            <dt>Votes</dt>
            <dd>{signedIn ? votes.length : "–"}</dd>
          </div>
        </dl>

        <div className="profile-buttons">
          <button className="outline-button" onClick={() => history && downloadHoursRecord(history)} disabled={!history || history.length === 0}>
            Download hours
          </button>
        </div>
        {USE_MOCK && <p className="muted small center">Sample sign-in for now, no real account.</p>}

        {!ready ? null : !signedIn ? (
          <p className="muted center">Sign in to see what you've signed up for, your votes and your volunteer hours.</p>
        ) : (
          <>
            <ul className="list-rows">
              <ListRow icon={<CircleCheck size={30} />} label="Coming up" count={upcoming.length} open={open === "upcoming"} onToggle={() => toggle("upcoming")}>
                {upcoming.length === 0 ? (
                  <p className="muted">
                    Nothing yet.{" "}
                    <Link className="text-link" to="/">
                      Find a way to help
                    </Link>
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
              </ListRow>

              <ListRow icon={<Bookmark size={30} fill="currentColor" />} label="Your votes" count={votes.length} open={open === "votes"} onToggle={() => toggle("votes")}>
                {votes.length === 0 ? (
                  <p className="muted">
                    You haven't voted yet.{" "}
                    <Link className="text-link" to="/issues">
                      See what needs fixing
                    </Link>
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
              </ListRow>

              <ListRow
                icon={<HeartHandshake size={30} />}
                label="Volunteer hours"
                count={history ? formatHours(totalHours) : "–"}
                open={open === "hours"}
                onToggle={() => toggle("hours")}
              >
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
                    <p className="action-note">"Download hours" gives a CSV you can print or send. Some schools ask for the organiser's signature too.</p>
                  </>
                )}
              </ListRow>
            </ul>

            <div className="stat-cards">
              <div className="stat-card">
                <Trophy size={30} className="stat-card-icon" aria-hidden="true" />
                <span>
                  <span className="stat-card-label">Hours logged</span>
                  <span className="stat-card-value">{history ? formatHours(totalHours) : "–"}</span>
                </span>
              </div>
              <div className="stat-card">
                <CalendarDays size={30} className="stat-card-icon accent" aria-hidden="true" />
                <span>
                  <span className="stat-card-label">Next up</span>
                  <span className="stat-card-value">
                    {next?.startsAt
                      ? new Date(next.startsAt).toLocaleDateString("en-CA", { timeZone: TZ, month: "short", day: "numeric" })
                      : next
                        ? "Ongoing"
                        : "None"}
                  </span>
                </span>
              </div>
            </div>

            {next && (
              <Link className="goal-card" to={`/volunteer/${encodeURIComponent(next.id)}`}>
                <span>
                  <span className="goal-title">Your next event</span>
                  <span className="goal-text">{next.title}</span>
                  <span className="goal-meta">
                    <Clock size={14} aria-hidden="true" /> {next.location}
                  </span>
                </span>
                <Trophy size={64} className="goal-trophy" aria-hidden="true" />
              </Link>
            )}
          </>
        )}
      </main>
    </div>
  );
}
