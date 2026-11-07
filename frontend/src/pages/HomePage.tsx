import { useEffect, useState } from "react";
import { getEvents, getIssues, setGoing, setMeToo } from "../api/client";
import PostCard from "../components/PostCard";
import TopBar from "../components/TopBar";
import { EVENT_CATEGORIES, ISSUE_CATEGORIES } from "../data/categories";
import type { FeedTab, Post } from "../types";

// Which tab a result belongs to, so switching tabs shows "Loading" instead of the old list.
interface FeedResult {
  tab: FeedTab;
  posts?: Post[];
  error?: string;
}

export default function HomePage() {
  const [tab, setTab] = useState<FeedTab>("events");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [toggled, setToggled] = useState<Set<string>>(new Set()); // "me too" and "join" taps
  const [result, setResult] = useState<FeedResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Load the feed from the API whenever the tab changes (or the user taps "Try again").
  useEffect(() => {
    let cancelled = false;
    const load = tab === "issues" ? getIssues() : getEvents();
    load
      .then((posts: Post[]) => {
        if (!cancelled) setResult({ tab, posts });
      })
      .catch((e: unknown) => {
        if (!cancelled) setResult({ tab, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, reloadKey]);

  const current = result?.tab === tab ? result : null;
  const loading = current === null;
  const categories = tab === "issues" ? ISSUE_CATEGORIES : EVENT_CATEGORIES;
  const q = query.trim().toLowerCase();

  const posts = (current?.posts ?? []).filter((p) => {
    if (category && p.category !== category) return false;
    if (q && !`${p.title} ${p.location} ${p.area}`.toLowerCase().includes(q)) return false;
    return true;
  });

  function changeTab(next: FeedTab) {
    setTab(next);
    setCategory(null); // categories differ between tabs
  }

  function toggleSearch() {
    if (searchOpen) setQuery("");
    setSearchOpen(!searchOpen);
  }

  function retry() {
    setResult(null);
    setReloadKey((k) => k + 1);
  }

  function flip(id: string) {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Update the button right away, then tell the backend. Undo if the request fails.
  function togglePost(id: string) {
    const post = current?.posts?.find((p) => p.id === id);
    if (!post) return;
    const on = !toggled.has(id);
    flip(id);
    const save = post.kind === "issue" ? setMeToo(id, on) : setGoing(id, on);
    save.catch(() => flip(id));
  }

  return (
    <div className="page">
      <header className="home-header">
        <TopBar
          tab={tab}
          onTabChange={changeTab}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen(!filtersOpen)}
          searchOpen={searchOpen}
          onToggleSearch={toggleSearch}
        />

        {searchOpen && (
          <input
            className="search-input"
            type="search"
            placeholder={tab === "issues" ? "Search a street or neighbourhood" : "Search events"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        )}

        {filtersOpen && (
          <div className="filter-row">
            <button
              className={`filter-chip ${category === null ? "selected" : ""}`}
              onClick={() => setCategory(null)}
            >
              All
            </button>
            {Object.entries(categories).map(([key, c]) => (
              <button
                key={key}
                className={`filter-chip ${category === key ? "selected" : ""}`}
                onClick={() => setCategory(key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="page-content">
        {loading && (
          <div className="feed" aria-busy="true" aria-label={`Loading ${tab}`}>
            {[150, 110, 190, 130].map((h, i) => (
              <div key={i} className="post-card skeleton" style={{ height: h + 90 }} />
            ))}
          </div>
        )}

        {current?.error && (
          <div className="empty" role="alert">
            <p>Couldn't load {tab}. Check your connection and try again.</p>
            <button className="chip-button" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {current?.posts && posts.length === 0 && (
          <div className="empty">
            <p>No {tab} match that yet.</p>
            <button
              className="chip-button"
              onClick={() => {
                setCategory(null);
                setQuery("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {posts.length > 0 && (
          <div className="feed">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} active={toggled.has(p.id)} onToggle={togglePost} />
            ))}
          </div>
        )}

        {import.meta.env.VITE_USE_MOCK !== "false" && <p className="sample-note">Sample data</p>}
      </main>
    </div>
  );
}
