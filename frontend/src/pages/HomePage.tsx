import { ChevronDown, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getTrack2Issues, getVolunteerEvents, setVote, USE_MOCK } from "../api/client";
import EventTile from "../components/EventTile";
import IssueTile from "../components/IssueTile";
import LocationSheet, { type LocateStatus } from "../components/LocationSheet";
import MasonryFeed from "../components/MasonryFeed";
import TopBar from "../components/TopBar";
import { coverRatio } from "../lib/cover";
import { DEFAULT_CITY, distanceTo, nearestCity, type City } from "../lib/geo";
import { issueScore, VAN311_URL } from "../lib/issues";
import { EVENT_SORTS, ISSUE_SORTS, sortEvents, sortIssues } from "../lib/sort";
import type { FeedTab, LatLng, SortKey, Track2Issue, VolunteerEvent, Vote } from "../types";

// One list per tab. No items and no error = still loading.
interface Loaded<T> {
  items?: T[];
  error?: string;
}

function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function HomePage() {
  const { tab: tabParam } = useParams();
  const tab: FeedTab = tabParam === "issues" ? "fix" : "help";

  const [events, setEvents] = useState<Loaded<VolunteerEvent>>({});
  const [issues, setIssues] = useState<Loaded<Track2Issue>>({});
  const [reloadKey, setReloadKey] = useState(0);

  // Where: a city (only Vancouver has data so far), plus the user's own position if they share it.
  const [city, setCity] = useState<City>(DEFAULT_CITY);
  const [here, setHere] = useState<LatLng | null>(null);
  const [locStatus, setLocStatus] = useState<LocateStatus>("idle");
  const [sheetOpen, setSheetOpen] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [eventSort, setEventSort] = useState<SortKey>("recommended");
  const [issueSort, setIssueSort] = useState<SortKey>("recommended");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Load both lists once (and again on "Try again"), so switching tabs is instant and keeps your votes.
  useEffect(() => {
    let cancelled = false;
    getVolunteerEvents()
      .then((items) => !cancelled && setEvents({ items }))
      .catch((e: unknown) => !cancelled && setEvents({ error: errorText(e) }));
    getTrack2Issues()
      .then((items) => !cancelled && setIssues({ items }))
      .catch((e: unknown) => !cancelled && setIssues({ error: errorText(e) }));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Ask for the position only when the user taps something that needs it.
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocStatus("unavailable");
      return;
    }
    setLocStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setHere(p);
        const c = nearestCity(p);
        if (c.available) {
          setCity(c);
          setLocStatus("found");
        } else {
          setLocStatus("outside");
        }
      },
      (err) => setLocStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Only "/" and "/issues" belong to this page.
  if (tabParam !== undefined && tabParam !== "issues") return <Navigate to="/" replace />;

  const current = tab === "help" ? events : issues;
  const loading = !current.items && !current.error;
  const q = query.trim().toLowerCase();
  const from = here ?? city.centre; // distances are from you, or from the city centre
  const sort = tab === "help" ? eventSort : issueSort;
  const sorts = tab === "help" ? EVENT_SORTS : ISSUE_SORTS;
  const ctx = { from, events: events.items ?? [], issues: issues.items ?? [] };

  const shownEvents = sortEvents(
    (events.items ?? []).filter((e) => !q || `${e.title} ${e.organiser} ${e.location} ${e.localArea}`.toLowerCase().includes(q)),
    eventSort,
    ctx,
  );
  const shownIssues = sortIssues(
    (issues.items ?? []).filter((i) => !q || `${i.request_type} ${i.address ?? ""} ${i.local_area}`.toLowerCase().includes(q)),
    issueSort,
    ctx,
  );
  const totalVotes = (issues.items ?? []).reduce((n, i) => n + issueScore(i).up + issueScore(i).down, 0);

  function pickSort(key: SortKey) {
    (tab === "help" ? setEventSort : setIssueSort)(key);
    if (key === "distance" && !here && locStatus === "idle") locate();
  }

  function toggleSearch() {
    if (searchOpen) setQuery("");
    setSearchOpen(!searchOpen);
  }

  function retry() {
    setEvents({});
    setIssues({});
    setReloadKey((k) => k + 1);
  }

  function setMyVote(id: string, value: Vote) {
    const before = issues.items?.find((i) => i.issue_id === id)?.my_vote ?? 0;
    const apply = (v: Vote) =>
      setIssues((prev) => ({
        ...prev,
        items: prev.items?.map((i) => (i.issue_id === id ? { ...i, my_vote: v } : i)),
      }));
    apply(value);
    setVote(id, value).catch(() => apply(before));
  }

  // Prefilled email the resident sends themselves: the 5 most pressing by vote score, whatever the sort.
  // We don't send anything, and we don't claim the City reads it.
  function councilMailto() {
    const top = [...(issues.items ?? [])].sort((a, b) => issueScore(b).score - issueScore(a).score).slice(0, 5);
    const lines = top.map(
      (i, n) =>
        `${n + 1}. ${i.request_type.replace(/ Case$/, "")} at ${i.address ?? i.local_area}: open ${i.days_open} days, reported ${i.times_reported_12m} times in the last 12 months`,
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
    ].join("\n");
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
          title={tab === "help" ? "Volunteer" : "Issues"}
          filtersOpen={filtersOpen}
          filtersActive={sort !== "recommended"}
          onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          searchOpen={searchOpen}
          onToggleSearch={toggleSearch}
        />

        <div className="location-row">
          <button className="location-pill" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
            <MapPin size={16} aria-hidden="true" />
            <span>{city.name}</span>
            {here && <span className="location-sub">· Near you</span>}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>

        {searchOpen && (
          <input
            className="search-input"
            type="search"
            aria-label="Search"
            placeholder={tab === "fix" ? "Search an issue or street" : "Search ways to help or organisers"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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

      <main className="page-content">
        {tab === "help" ? (
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

        {loading && (
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
            <p>Couldn't load {tab === "fix" ? "issues" : "ways to help"}. Check your connection and try again.</p>
            <button className="chip-button" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {tab === "help" && events.items && shownEvents.length === 0 && (
          <div className="empty">
            <p>{q ? "Nothing matches that yet." : "No ways to help here yet. Start one from a hotspot on the map."}</p>
          </div>
        )}

        {tab === "help" && shownEvents.length > 0 && (
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

        {tab === "fix" && issues.items && shownIssues.length === 0 && (
          <div className="empty">
            <p>{q ? "No issues match that yet." : "No open City issues here right now."}</p>
          </div>
        )}

        {tab === "fix" && shownIssues.length > 0 && (
          <>
            <MasonryFeed
              label="Issues"
              items={shownIssues.map((i, n) => {
                const ratio = coverRatio(i.issue_id);
                return {
                  key: i.issue_id,
                  ratio,
                  node: (
                    <IssueTile
                      issue={i}
                      rank={n + 1}
                      ratio={ratio}
                      distanceKm={here ? distanceTo(here, i) : undefined}
                      onVote={setMyVote}
                    />
                  ),
                };
              })}
            />
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
