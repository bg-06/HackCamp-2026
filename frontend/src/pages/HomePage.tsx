import { LocateFixed, TriangleAlert } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { USE_MOCK } from "../api/client";
import EventTile from "../components/EventTile";
import IssueRow from "../components/IssueRow";
import VotesLeft from "../components/VotesLeft";
import MasonryFeed from "../components/MasonryFeed";
import TopBar from "../components/TopBar";
import { coverRatio, requestTypeInSentence } from "../lib/cover";
import { hotspotKind } from "../lib/hotspots";
import { CITY, distanceTo, formatKm } from "../lib/geo";
import { issueScore, VAN311_URL } from "../lib/issues";
import { EVENT_SORTS, ISSUE_SORTS, sortEvents, sortIssues } from "../lib/sort";
import { useFeed, type LocateStatus } from "../state/feed";
import type { FeedTab, SortKey, Vote } from "../types";

const LOCATION_NOTES: Partial<Record<LocateStatus, { text: string; warn?: boolean }>> = {
  locating: { text: "Finding you…" },
  outside: { text: "You're outside Vancouver. We only have Vancouver data so far, but distances are from where you are." },
  denied: { text: "Location is off for this site. You can turn it on in your browser settings.", warn: true },
  unavailable: { text: "Couldn't get your location. Try again in a moment.", warn: true },
  insecure: { text: "Location only works over https.", warn: true },
};

export default function HomePage() {
  const { tab: tabParam } = useParams();
  const tab: FeedTab = tabParam === "issues" ? "issues" : "volunteer";

  const {
    events,
    issues,
    hotspots,
    reload,
    here,
    locStatus,
    toggleNearMe,
    eventSort,
    setEventSort,
    issueSort,
    setIssueSort,
    query,
    setQuery,
    searchOpen,
    setSearchOpen,
    getScroll,
    saveScroll,
    getIssueLimit,
    saveIssueLimit,
    setMyVote,
    requireSignIn,
  } = useFeed();
  const [sortOpen, setSortOpen] = useState(false);
  const [hotspotLimit, setHotspotLimit] = useState(20);
  const contentRef = useRef<HTMLElement>(null);

  // Back from a card: put the list where it was
  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = getScroll(tab);
  }, [tab, getScroll]);

  const from = here ?? CITY.centre; // distances are from you, or from City Hall
  const eventQ = query.volunteer.trim().toLowerCase();
  const issueQ = query.issues.trim().toLowerCase();
  const ctx = { from, events: events.items ?? [], issues: issues.items ?? [] };

  // Issues keep their order while you're on the page, so a row you vote on doesn't jump away from
  // under your finger. The order (and the #) is worked out again when the sort, search, location or
  // list changes, or when you come back to the tab. "For you" also uses your sign-ups, so it waits for events.
  const orderKey = [
    tab,
    issueSort,
    issueQ,
    here ? `${here.lat},${here.lng}` : "",
    events.items ? "events" : "",
    (issues.items ?? []).map((i) => i.issue_id).join(),
  ].join("|");
  const [issueOrder, setIssueOrder] = useState<{ key: string; ids: string[]; rank: Map<string, number> } | null>(null);
  if (issues.items && issueOrder?.key !== orderKey) {
    const matching = issues.items.filter(
      (i) => !issueQ || `${i.request_type} ${i.address ?? ""} ${i.local_area}`.toLowerCase().includes(issueQ),
    );
    const byScore = [...issues.items].sort((a, b) => issueScore(b).score - issueScore(a).score);
    setIssueOrder({
      key: orderKey,
      ids: sortIssues(matching, issueSort, ctx).map((i) => i.issue_id),
      rank: new Map(byScore.map((i, n) => [i.issue_id, n + 1])),
    });
  }

  const issueById = new Map((issues.items ?? []).map((i) => [i.issue_id, i]));
  const shownIssues = (issueOrder?.ids ?? []).flatMap((id) => issueById.get(id) ?? []);
  // Draw the list 50 rows at a time; more load as you near the end (or with the button).
  const [, redraw] = useState(0);
  const issueLimit = getIssueLimit(orderKey);
  const visibleIssues = shownIssues.slice(0, issueLimit);
  const moreIssues = shownIssues.length - visibleIssues.length;
  const showMoreIssues = () => {
    saveIssueLimit(orderKey, issueLimit + 50);
    redraw((n) => n + 1);
  };
  const hasMoreIssues = moreIssues > 0;
  const moreRef = useRef<HTMLButtonElement>(null);
  const showMoreRef = useRef(showMoreIssues);
  useEffect(() => {
    showMoreRef.current = showMoreIssues;
  });
  useEffect(() => {
    const el = moreRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && showMoreRef.current(), {
      root: contentRef.current,
      rootMargin: "600px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMoreIssues, tab]);

  // Only "/" and "/issues" belong to this page.
  if (tabParam !== undefined && tabParam !== "issues") return <Navigate to="/" replace />;

  const current = tab === "volunteer" ? events : issues;
  const loading = !current.items && !current.error;
  const q = tab === "volunteer" ? eventQ : issueQ;
  const sort = tab === "volunteer" ? eventSort : issueSort;
  const sorts = tab === "volunteer" ? EVENT_SORTS : ISSUE_SORTS;

  const shownEvents = sortEvents(
    (events.items ?? []).filter((e) => !eventQ || `${e.title} ${e.organiser} ${e.location} ${e.localArea}`.toLowerCase().includes(eventQ)),
    eventSort,
    ctx,
  );

  // Spots that keep getting reported and have nothing planned yet
  const planned = new Set((events.items ?? []).map((e) => e.hotspotId).filter(Boolean));
  const openHotspots = (hotspots.items ?? [])
    .filter((h) => !planned.has(h.id))
    .sort((a, b) => (here ? (distanceTo(here, a) ?? Infinity) - (distanceTo(here, b) ?? Infinity) : b.times_reported - a.times_reported));
  const sampleCount = (events.items ?? []).filter((e) => e.sample).length;

  function pickSort(key: SortKey) {
    (tab === "volunteer" ? setEventSort : setIssueSort)(key);
    if (key === "distance" && !here && locStatus === "off") toggleNearMe();
  }

  function toggleSearch() {
    if (searchOpen[tab]) setQuery(tab, "");
    setSearchOpen(tab, !searchOpen[tab]);
  }

  function vote(id: string, value: Vote) {
    requireSignIn("vote", () => setMyVote(id, value));
  }

  // A prefilled email the resident sends themselves. We don't send anything.
  function councilMailto() {
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const lines = [...(issues.items ?? [])]
      .sort((a, b) => issueScore(b).score - issueScore(a).score)
      .slice(0, 5)
      .map(
        (i, n) =>
          `${n + 1}. ${i.request_type.replace(/ Case$/, "")} at ${i.address ?? i.local_area}: open ${plural(i.days_open, "day")}, reported ${plural(i.times_reported_12m, "time")} in the last 12 months`,
      );
    const body = [
      `Hello,`,
      ``,
      `These are the most pressing City issues in ${CITY.name}, as voted by neighbours on Block by Block:`,
      ``,
      ...lines,
      ``,
      `Report or follow up in Van311: ${VAN311_URL}`,
      ``,
      `Thank you.`,
    ].join("\r\n"); // mailto bodies need CRLF, or some mail apps put it all on one line
    return `mailto:?subject=${encodeURIComponent(`Most pressing issues in ${CITY.name}`)}&body=${encodeURIComponent(body)}`;
  }

  const locationNote = LOCATION_NOTES[locStatus];

  return (
    <div className="page">
      <header className={`home-header track-${tab}`}>
        <TopBar tab={tab} searchOpen={searchOpen[tab]} onToggleSearch={toggleSearch} menuOpen={sortOpen} onToggleMenu={() => setSortOpen(!sortOpen)} />

        {sortOpen && (
          <div className="filter-row" role="group" aria-label="Sort by">
            <button className={`filter-chip ${here ? "selected" : ""}`} aria-pressed={Boolean(here)} onClick={toggleNearMe} disabled={locStatus === "locating"}>
              <LocateFixed size={14} aria-hidden="true" /> Near me
            </button>
            <span className="filter-divider" aria-hidden="true" />
            {sorts.map((s) => (
              <button
                key={s.key}
                className={`filter-chip ${sort === s.key ? "selected" : ""}`}
                aria-pressed={sort === s.key}
                onClick={() => pickSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {searchOpen[tab] && (
          <input
            className="search-input"
            type="search"
            aria-label="Search"
            placeholder={tab === "issues" ? "Search an issue or street" : "Search ways to help or organisers"}
            value={query[tab]}
            onChange={(e) => setQuery(tab, e.target.value)}
            autoFocus
          />
        )}
      </header>

      <main className="page-content" ref={contentRef} onScroll={(e) => saveScroll(tab, e.currentTarget.scrollTop)}>
        {locationNote &&
          (locationNote.warn ? (
            <p className="form-error" role="status">
              <TriangleAlert size={16} aria-hidden="true" />
              {locationNote.text}
            </p>
          ) : (
            <p className="sort-hint" role="status">
              {locationNote.text}
            </p>
          ))}
        {sort === "distance" && !here && locStatus !== "locating" && (
          <p className="sort-hint">Distances are from City Hall. Turn on Near me for distances from you.</p>
        )}

        {tab === "volunteer" ? (
          <section className="intro">
            <h2>Help out in {CITY.name}</h2>
            <p>
              Cleanups and other ways to help, run by the City, local groups and neighbours. Many are on blocks where the same problem keeps
              getting reported.
            </p>
            {sampleCount > 0 && (
              <p className="muted small">
                {sampleCount === events.items?.length ? "All" : `${sampleCount} of ${events.items?.length}`} listings are samples, not yet
                confirmed with the organiser.
              </p>
            )}
          </section>
        ) : (
          <section className="intro">
            <h2>What needs fixing in {CITY.name}</h2>
            <p>Prioritize issues the City can fix.</p>
            <VotesLeft />
            <details className="score-explainer"><summary>How scores work</summary><p>Scores combine votes, time open, and reports.</p></details>
            <a className="text-link" href={VAN311_URL} target="_blank" rel="noopener noreferrer">
              Report something new in Van311 ↗
            </a>
          </section>
        )}

        {tab === "volunteer" && openHotspots.length > 0 && (
          <section className="needs-help" aria-labelledby="needs-help-heading">
            <div className="needs-help-head">
              <h2 id="needs-help-heading">Needs help</h2>
              <p className="muted small">{openHotspots.length} reported spots, nothing planned</p>
            </div>
            <ul className="help-strip" tabIndex={0} aria-label="Spots that need help">
              {openHotspots.slice(0, hotspotLimit).map((h) => (
                <li key={h.id} className="help-card">
                  <Link className="help-card-link" to={`/volunteer/new?hotspot=${encodeURIComponent(h.id)}`}>
                    <span className="help-card-top">
                      <span className="help-count">{h.times_reported} reports</span>
                      {here && h.lat !== undefined && <span className="muted small">{formatKm(distanceTo(here, h)!)}</span>}
                    </span>
                    <span className="row-title">{requestTypeInSentence(h.request_type)}</span>
                    <span className="muted small">{h.near ?? h.local_area} · {h.months_seen} months</span>
                    <span className="help-start">{hotspotKind(h.request_type, h.category).action === 'report' ? 'Report this' : 'Start an event'} <span aria-hidden="true">→</span></span>
                  </Link>
                </li>
              ))}
              {hotspotLimit < openHotspots.length && (
                <li className="help-card help-more">
                  <button className="chip-button" onClick={() => setHotspotLimit((limit) => limit + 20)}>Show more spots</button>
                </li>
              )}
            </ul>
          </section>
        )}

        {loading && tab === "issues" && (
          <div className="issue-list" aria-busy="true" aria-label="Loading">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 96 }} />
            ))}
          </div>
        )}

        {loading && tab === "volunteer" && (
          <div className="masonry" aria-busy="true" aria-label="Loading">
            {[0, 1].map((c) => (
              <div key={c} className="masonry-col">
                {[1.25, 1].map((r, i) => (
                  <div key={i} className="tile skeleton" style={{ aspectRatio: `1 / ${r + 0.5}` }} />
                ))}
              </div>
            ))}
          </div>
        )}

        {current.error && (
          <div className="empty" role="alert">
            <p>Couldn't load {tab === "issues" ? "issues" : "ways to help"}. Check your connection and try again.</p>
            <button className="chip-button" onClick={reload}>
              Try again
            </button>
          </div>
        )}

        {tab === "volunteer" && events.items && shownEvents.length === 0 && (
          <div className="empty">
            <p>{q ? "Nothing matches that yet." : "No ways to help here yet. Start one from a spot above."}</p>
          </div>
        )}

        {tab === "volunteer" && shownEvents.length > 0 && (
          <>
            {openHotspots.length > 0 && <h2 className="feed-heading">Ways to help</h2>}
            <MasonryFeed
              label="Ways to volunteer"
              items={shownEvents.map((e) => {
                const ratio = coverRatio(e.id, Boolean(e.photoUrl));
                return {
                  key: e.id,
                  ratio,
                  node: <EventTile event={e} ratio={ratio} distanceKm={here ? distanceTo(here, e) : undefined} />,
                };
              })}
            />
          </>
        )}

        {tab === "issues" && issues.items && shownIssues.length === 0 && (
          <div className="empty">
            <p>{q ? "No issues match that yet." : "No open City issues here right now."}</p>
          </div>
        )}

        {tab === "issues" && shownIssues.length > 0 && (
          <>
            <ul className="issue-list" aria-label="Issues">
              {visibleIssues.map((i) => (
                <li key={i.issue_id}>
                  <IssueRow
                    issue={i}
                    rank={issueOrder?.rank.get(i.issue_id) ?? 0}
                    distanceKm={here ? distanceTo(here, i) : undefined}
                    onVote={vote}
                  />
                </li>
              ))}
            </ul>
            {moreIssues > 0 && (
              <button ref={moreRef} className="action-button secondary" onClick={showMoreIssues}>
                Show {Math.min(50, moreIssues)} more of {moreIssues}
              </button>
            )}
            <a className="action-button council" href={councilMailto()}>
              Send the top 5 to Council
            </a>
            <p className="action-note center">Opens an email in your own mail app. You choose who to send it to.</p>
          </>
        )}

        {USE_MOCK && tab === "issues" && <p className="sample-note">Sample data</p>}
      </main>
    </div>
  );
}
