import { LocateFixed, TriangleAlert } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { USE_MOCK } from "../api/client";
import EventTile from "../components/EventTile";
import IssueRow from "../components/IssueRow";
import VotesLeft from "../components/VotesLeft";
import MasonryFeed from "../components/MasonryFeed";
import TopBar from "../components/TopBar";
import { coverRatio } from "../lib/cover";
import { mergeNeighbours, spreadByArea } from "../lib/hotspots";
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [area, setArea] = useState(() => localStorage.getItem('issue-area') ?? '');
  const [category, setCategory] = useState('');
  const [myVotesOnly, setMyVotesOnly] = useState(false);
  const [hotspotLimit, setHotspotLimit] = useState(3);
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
    area, category, String(myVotesOnly),
    myVotesOnly ? (issues.items ?? []).filter(i => i.my_vote === 1).map(i => i.issue_id).join() : '',
    events.items ? "events" : "",
    (issues.items ?? []).map((i) => i.issue_id).join(),
  ].join("|");
  const [issueOrder, setIssueOrder] = useState<{ key: string; ids: string[]; rank: Map<string, number> } | null>(null);
  if (issues.items && issueOrder?.key !== orderKey) {
    const matching = issues.items.filter(
      (i) => (!issueQ || `${i.request_type} ${i.address ?? ""} ${i.local_area}`.toLowerCase().includes(issueQ)) && (!area || i.local_area === area) && (!category || i.category === category) && (!myVotesOnly || i.my_vote === 1),
    );
    const byScore = [...issues.items].sort((a, b) => issueScore(b).score - issueScore(a).score);
    setIssueOrder({
      key: orderKey,
      ids: sortIssues(matching, issueSort, ctx).sort((a, b) => issueSort === 'recommended' && here && !area ? Number((distanceTo(here, a) ?? Infinity) > 3) - Number((distanceTo(here, b) ?? Infinity) > 3) : 0).map((i) => i.issue_id),
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
  // Touching cells with the same problem are one place. With your location: nearest first.
  // Without: the most persistent place in each neighbourhood first, so it isn't all Downtown.
  const places = mergeNeighbours(hotspots.items ?? []).filter((p) => !p.cellIds.some((id) => planned.has(id)));
  const openHotspots = here
    ? places.sort((a, b) => (distanceTo(here, a.hotspot) ?? Infinity) - (distanceTo(here, b.hotspot) ?? Infinity))
    : spreadByArea(places);
  const hotspotsShown = openHotspots.slice(0, hotspotLimit);
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
  const helpId = `${tab}-feed-help`;

  // Prototype: the recurring-spots rail breaks up the feed like an Instagram interstitial
  // about ten posts down, instead of sitting above every post.
  const FEED_BREAK_AFTER = 10;
  const breakAt = Math.min(FEED_BREAK_AFTER, shownEvents.length);
  const feedEvents = shownEvents.slice(0, breakAt);
  const moreEvents = shownEvents.slice(breakAt);
  const feedItem = (e: (typeof shownEvents)[number]) => {
    const ratio = coverRatio(e.id, Boolean(e.photoUrl));
    return {
      key: e.id,
      ratio,
      node: <EventTile event={e} ratio={ratio} distanceKm={here ? distanceTo(here, e) : undefined} />,
    };
  };

  const needsHelpRail = openHotspots.length > 0 && (
    <section className="needs-help" aria-labelledby="needs-help-heading">
      <div className="needs-help-head">
        <h2 id="needs-help-heading">Needs help</h2>
        <p className="muted small">{openHotspots.length} reported spots, nothing planned</p>
      </div>
      <ul className="help-strip" tabIndex={0} aria-label="Spots that need help">
        {hotspotsShown.map((p) => {
          const report = p.action === "report";
          const body = (
            <>
              <span className="help-card-top">
                <span className="help-count">{p.reports} reports</span>
                {here && p.hotspot.lat !== undefined && <span className="muted small">{formatKm(distanceTo(here, p.hotspot)!)}</span>}
              </span>
              <span className="row-title">{p.label}</span>
              <span className="muted small">{p.hotspot.near ?? p.hotspot.local_area} · {p.monthsSeen} of 12 months</span>
              <span className="help-start">
                {report ? "Report to the City" : p.action === "walk" ? "Plan a walk" : "Start a cleanup"} <span aria-hidden="true">{report ? "↗" : "→"}</span>
              </span>
            </>
          );
          return (
            <li key={p.id} className="help-card">
              {report ? (
                <a className="help-card-link" href={VAN311_URL} target="_blank" rel="noopener noreferrer">
                  {body}
                </a>
              ) : (
                <Link className="help-card-link" to={`/volunteer/new?hotspot=${encodeURIComponent(p.id)}`}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
        {openHotspots.length > hotspotsShown.length && (
          <li className="help-card help-more">
            <button className="chip-button" onClick={() => setHotspotLimit((n) => n + 5)}>
              Show {Math.min(5, openHotspots.length - hotspotsShown.length)} more
            </button>
          </li>
        )}
      </ul>
    </section>
  );

  return (
    <div className="page">
      <header className={`home-header track-${tab}`}>
        <TopBar tab={tab} searchOpen={searchOpen[tab]} onToggleSearch={toggleSearch} menuOpen={sortOpen} onToggleMenu={() => setSortOpen(!sortOpen)} />

        {tab === 'issues' && <div className="filter-row issue-filters">
          <label>Neighbourhood <select value={area} onChange={e => { setArea(e.target.value); localStorage.setItem('issue-area', e.target.value) }}>
            <option value="">All Vancouver</option>
            {[...new Set((issues.items ?? []).map(i => i.local_area).filter(Boolean))].sort().map(a => <option key={a} value={a}>{a}</option>)}
          </select></label>
          <label>Category <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {[...new Set((issues.items ?? []).map(i => i.category).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}
          </select></label>
          <button className={`filter-chip ${myVotesOnly ? 'selected' : ''}`} aria-pressed={myVotesOnly} onClick={() => setMyVotesOnly(!myVotesOnly)}>My votes</button>
        </div>}

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

        <section className="feed-intro">
          <div className="feed-intro-summary">
            <p>{tab === "volunteer" ? `Find ways to help around ${CITY.name}.` : "Vote on the City issues that matter most."}</p>
            <button
              className="help-button"
              type="button"
              aria-label={`${helpOpen ? "Hide" : "Show"} ${tab} help`}
              aria-expanded={helpOpen}
              aria-controls={helpId}
              onClick={() => setHelpOpen(!helpOpen)}
            >
              ?
            </button>
          </div>
          {tab === "issues" && <VotesLeft />}
          {helpOpen && (
            <div className="feed-help" id={helpId}>
              <p>
                {tab === "volunteer"
                  ? "Browse opportunities from local groups and neighbours, including help organized around recurring problem spots."
                  : "Filter by neighbourhood or use Near me. Priority scores combine votes, time open and repeat reports."}
              </p>
              {tab === "issues" && (
                <a className="text-link" href={VAN311_URL} target="_blank" rel="noopener noreferrer">
                  Report something new in Van311 ↗
                </a>
              )}
              {tab === "volunteer" && sampleCount > 0 && (
                <p className="muted small">
                  {sampleCount === events.items?.length ? "All" : `${sampleCount} of ${events.items?.length}`} listings are samples, not yet confirmed with the organiser.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Prototype: "Ways to help" leads the volunteer feed. The recurring-spots rail is
            injected partway down the posts instead of sitting above them. */}
        {tab === "volunteer" && (openHotspots.length > 0 || shownEvents.length > 0) && (
          <h2 className="feed-heading" id="ways-to-help-heading">Ways to help</h2>
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
          <>
            {!q && needsHelpRail}
            <div className="empty">
              <p>{q ? "Nothing matches that yet." : "No ways to help here yet. Start one from a spot above."}</p>
            </div>
          </>
        )}

        {tab === "volunteer" && shownEvents.length > 0 && (
          <>
            <MasonryFeed label="Ways to volunteer" items={feedEvents.map(feedItem)} />
            {needsHelpRail}
            {moreEvents.length > 0 && <MasonryFeed label="Ways to volunteer, continued" items={moreEvents.map(feedItem)} />}
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
