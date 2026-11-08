import { CalendarDays, MessageCircle, SquarePen, TriangleAlert, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createForumPost, getForumPosts, getVolunteerEvents, USE_MOCK } from "../api/client";
import { AUTHOR_BADGES, BODY_MAX, formatPosted, TITLE_MAX } from "../lib/forum";
import type { ForumPost, VolunteerEvent } from "../types";

const ALL_AREAS = "All areas";
const DEFAULT_AREA = "Mount Pleasant";

export default function ForumPage() {
  const [posts, setPosts] = useState<ForumPost[] | null>(null);
  const [events, setEvents] = useState<VolunteerEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [area, setArea] = useState(DEFAULT_AREA);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [postArea, setPostArea] = useState(DEFAULT_AREA);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getForumPosts()
      .then((p) => !cancelled && setPosts(p))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    // Only used to show which event a thread is about; the forum still works without it.
    getVolunteerEvents()
      .then((e) => !cancelled && setEvents(e))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const areas = Array.from(new Set([DEFAULT_AREA, ...(posts ?? []).map((p) => p.localArea), ...events.map((e) => e.localArea)])).sort();
  const shown = (posts ?? []).filter((p) => area === ALL_AREAS || p.localArea === area);
  const eventTitle = (id?: string) => events.find((e) => e.id === id)?.title;

  function openComposer() {
    setPostArea(area === ALL_AREAS ? DEFAULT_AREA : area);
    setSendError(null);
    setComposing(true);
  }

  function closeComposer() {
    setComposing(false);
    setTitle("");
    setBody("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const post = await createForumPost({ localArea: postArea, title: title.trim(), body: body.trim() });
      setPosts((prev) => [post, ...(prev ?? [])]);
      setArea(post.localArea); // show the board the post went to
      closeComposer();
    } catch {
      setSendError("Couldn't post. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <header className="home-header">
        <div className="top-bar">
          <span aria-hidden="true" />
          <h1 className="header-title">Neighbourhood forum</h1>
          <button
            className={`icon-button ${composing ? "active" : ""}`}
            onClick={composing ? closeComposer : openComposer}
            aria-label={composing ? "Cancel new post" : "New post"}
            aria-expanded={composing}
          >
            {composing ? <X size={22} /> : <SquarePen size={22} />}
          </button>
        </div>
        <label className="area-picker">
          <span className="visually-hidden">Neighbourhood</span>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value={ALL_AREAS}>{ALL_AREAS}</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="page-content">
        {composing && (
          <form className="composer" onSubmit={submit}>
            <h2>New post</h2>
            <label>
              <span>Neighbourhood</span>
              <select value={postArea} onChange={(e) => setPostArea(e.target.value)}>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required autoFocus />
            </label>
            <label>
              <span>Message</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} rows={5} required />
            </label>
            {sendError && (
              <p className="form-error" role="alert">
                <TriangleAlert size={16} aria-hidden="true" />
                {sendError}
              </p>
            )}
            <button className="action-button" type="submit" disabled={sending || !title.trim() || !body.trim()}>
              {sending ? "Posting…" : "Post"}
            </button>
            <p className="action-note">Posts are public. Be kind, and don't share anyone's personal details.</p>
          </form>
        )}

        {!posts && !error && (
          <div className="feed" aria-busy="true" aria-label="Loading posts">
            {[110, 140, 110].map((h, i) => (
              <div key={i} className="post-card skeleton" style={{ height: h }} />
            ))}
          </div>
        )}

        {error && (
          <div className="empty" role="alert">
            <p>Couldn't load the forum. Check your connection and try again.</p>
            <button
              className="chip-button"
              onClick={() => {
                setError(null);
                setReloadKey((k) => k + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {posts && shown.length === 0 && (
          <div className="empty">
            <p>No posts in {area} yet. Start the conversation.</p>
            {!composing && (
              <button className="chip-button" onClick={openComposer}>
                New post
              </button>
            )}
          </div>
        )}

        {shown.length > 0 && (
          <ul className="thread-list">
            {shown.map((p) => {
              const badge = AUTHOR_BADGES[p.authorKind];
              const about = eventTitle(p.linkedEventId);
              return (
                <li key={p.id}>
                  <Link className="thread-card" to={`/forum/${encodeURIComponent(p.id)}`}>
                    <div className="badge-row">
                      {badge && <span className={`kind-badge ${badge.className}`}>{badge.label}</span>}
                      {area === ALL_AREAS && <span className="category-chip neutral">{p.localArea}</span>}
                      {p.sample && <span className="sample-tag">Sample</span>}
                    </div>
                    <h3>{p.title}</h3>
                    <p className="thread-preview">{p.body}</p>
                    {about && (
                      <p className="thread-about">
                        <CalendarDays size={13} aria-hidden="true" /> About: {about}
                      </p>
                    )}
                    <p className="thread-meta">
                      <span>
                        {p.author} · {formatPosted(p.createdAt)}
                      </span>
                      <span>
                        <MessageCircle size={13} aria-hidden="true" /> {p.replyCount}{" "}
                        <span className="visually-hidden">{p.replyCount === 1 ? "reply" : "replies"}</span>
                      </span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {USE_MOCK && <p className="sample-note">Sample data. New posts are kept only until you reload the page.</p>}
      </main>
    </div>
  );
}
