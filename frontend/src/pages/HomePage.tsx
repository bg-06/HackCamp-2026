import { ChevronDown, MapPin } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { USE_MOCK } from "../api/client";
import EventTile from "../components/EventTile";
import IssueRow from "../components/IssueRow";
import LocationSheet from "../components/LocationSheet";
import MasonryFeed from "../components/MasonryFeed";
import TopBar from "../components/TopBar";
import { coverRatio } from "../lib/cover";
import { distanceTo } from "../lib/geo";
import { issueScore, VAN311_URL } from "../lib/issues";
import { EVENT_SORTS, ISSUE_SORTS, sortEvents, sortIssues } from "../lib/sort";
import { useFeed } from "../state/feed";
import type { FeedTab, SortKey } from "../types";

export default function HomePage() {
  const { tab: tabParam } = useParams();
  const tab: FeedTab = tabParam === "issues" ? "issues" : "volunteer";

  const {
    events,
    issues,
    reload,
    city,
    setCity,
    here,
    locStatus,
    locate,
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
    setMyVote,
  } = useFeed();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  // Back from a card: put the list where it was
  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = getScroll(tab);
  }, [tab, getScroll]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Only "/" and "/issues" belong to this page.
  if (tabParam !== undefined && tabParam !== "issues") return <Navigate to="/" replace />;

  const current = tab === "volunteer" ? events : issues;
  const loading = !current.items && !current.error;
  const eventQ = query.volunteer.trim().toLowerCase();
  const issueQ = query.issues.trim().toLowerCase();
  const q = tab === "volunteer" ? eventQ : issueQ;
  const from = here ?? city.centre; // distances are from you, or from the city centre
  const sort = tab === "volunteer" ? eventSort : issueSort;
  const sorts = tab === "volunteer" ? EVENT_SORTS : ISSUE_SORTS;
  const ctx = { from, events: events.items ?? [], issues: issues.items ?? [] };

  const shownEvents = sortEvents(
    (events.items ?? []).filter((e) => !eventQ || `${e.title} ${e.organiser} ${e.location} ${e.localArea}`.toLowerCase().includes(eventQ)),
    eventSort,
    ctx,
  );
  const shownIssues = sortIssues(
    (issues.items ?? []).filter((i) => !issueQ || `${i.request_type} ${i.address ?? ""} ${i.local_area}`.toLowerCase().includes(issueQ)),
    issueSort,
    ctx,
  );
  // "#1" always means most pressing by votes, whatever the sort. Same order as the Council email.
  const byScore = [...(issues.items ?? [])].sort((a, b) => issueScore(b).score - issueScore(a).score);
  const rank = new Map(byScore.map((i, n) => [i.issue_id, n + 1]));
  const totalVotes = (issues.items ?? []).reduce((n, i) => n + issueScore(i).up + issueScore(i).down, 0);

  function pickSort(key: SortKey) {
    (tab === "volunteer" ? setEventSort : setIssueSort)(key);
    if (key === "distance" && !here && locStatus === "idle") locate();
  }

  function toggleSearch() {
    if (searchOpen[tab]) setQuery(tab, "");
    setSearchOpen(tab, !searchOpen[tab]);
  }

  // A prefilled email the resident sends themselves. We don't send anything.
  function councilMailto() {
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const lines = byScore
      .slice(0, 5)
      .map(
        (i, n) =>
          `${n + 1}. ${i.request_type.replace(/ Case$/, "")} at ${i.address ?? i.local_area}: open ${plural(i.days_open, "day")}, reported ${plural(i.times_reported_12m, "time")} in the last 12 months`,
      );
    const body = [
      `Hello,`,
      ``,
      `These are the most pressing City issues in ${city.name}, as voted by neighbours on Block by Block:`,
      ``,
      ...lines,
      ``,
      `Report or follow up in Van311: ${VAN311_URL}`,
      ``,
      `Thank you.`,
    ].join("\r\n"); // mailto bodies need CRLF, or some mail apps put it all on one line
    return `mailto:?subject=${encodeURIComponent(`Most pressing issues in ${city.name}`)}&body=${encodeURIComponent(body)}`;
  }

  const distanceHint = sort === "distance" && !here && (
    <p className="sort-hint">
      Distances are from {city.name} City Hall.{" "}
      <button className="link-button" onClick={() => setSheetOpen(true)}>
        Use your location
      </button>
    </p>
  );

  return (
    <div className="page">
      <header className={`home-header track-${tab}`}>
        <TopBar
          title={tab === "volunteer" ? "Volunteer" : "Issues"}
          filtersOpen={filtersOpen}
          filtersActive={sort !== "recommended"}
          onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          searchOpen={searchOpen[tab]}
          onToggleSearch={toggleSearch}
        />

        <div className="location-row">
          <button className="location-pill" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
            <MapPin size={16} aria-hidden="true" />
            <span>{city.name}</span>
            {locStatus === "found" && <span className="location-sub">· Near you</span>}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>

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

        {filtersOpen && (
          <div className="filter-row" role="group" aria-label="Sort by">
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
      </header>

      <main className="page-content" ref={contentRef} onScroll={(e) => saveScroll(tab, e.currentTarget.scrollTop)}>
        {tab === "volunteer" ? (
          <section className="intro">
            <h2>Help out in {city.name}</h2>
            <p>
              Cleanups and other ways to help, run by the City, local groups and neighbours. Many are on blocks where the same problem keeps
              getting reported.
            </p>
          </section>
        ) : (
          <section className="intro">
            <h2>What needs fixing in {city.name}</h2>
            <p>
              Only the City can fix these. Vote up if it affects you, down if it's not a problem or already fixed.
              {issues.items && ` ${totalVotes} ${totalVotes === 1 ? "vote" : "votes"} so far.`}
            </p>
            <a className="text-link" href={VAN311_URL} target="_blank" rel="noopener noreferrer">
              Report something new in Van311 ↗
            </a>
          </section>
        )}

        {distanceHint}

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
            <p>{q ? "Nothing matches that yet." : "No ways to help here yet. Start one from a hotspot on the map."}</p>
          </div>
        )}

        {tab === "volunteer" && shownEvents.length > 0 && (
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
        )}

        {tab === "issues" && issues.items && shownIssues.length === 0 && (
          <div className="empty">
            <p>{q ? "No issues match that yet." : "No open City issues here right now."}</p>
          </div>
        )}

        {tab === "issues" && shownIssues.length > 0 && (
          <>
            <ul className="issue-list" aria-label="Issues">
              {shownIssues.map((i) => (
                <li key={i.issue_id}>
                  <IssueRow
                    issue={i}
                    rank={rank.get(i.issue_id) ?? 0}
                    distanceKm={here ? distanceTo(here, i) : undefined}
                    onVote={setMyVote}
                  />
                </li>
              ))}
            </ul>
            <a className="action-button council" href={councilMailto()}>
              Send the top 5 to Council
            </a>
            <p className="action-note center">Opens an email in your own mail app. You choose who to send it to.</p>
          </>
        )}

        {USE_MOCK && <p className="sample-note">Sample data</p>}
      </main>

      {sheetOpen && (
        <LocationSheet
          city={city}
          status={locStatus}
          onUseLocation={locate}
          onPickCity={(c) => {
            setCity(c);
            setSheetOpen(false);
          }}
          onClose={closeSheet}
        />
      )}
    </div>
  );
}
