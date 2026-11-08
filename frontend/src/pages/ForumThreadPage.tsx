import { ChevronLeft, TriangleAlert } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { createForumReply, getForumThread, getVolunteerEvents, setGoing } from "../api/client";
import VolunteerCard from "../components/VolunteerCard";
import { AUTHOR_BADGES, formatPosted, REPLY_MAX } from "../lib/forum";
import type { AuthorKind, ForumPost, ForumReply, VolunteerEvent } from "../types";

type Thread = { post: ForumPost; replies: ForumReply[] };

function Author({ name, kind, createdAt }: { name: string; kind: AuthorKind; createdAt: string }) {
  const badge = AUTHOR_BADGES[kind];
  return (
    <p className="thread-meta">
      <span>
        <strong>{name}</strong> · {formatPosted(createdAt)}
      </span>
      {badge && <span className={`kind-badge ${badge.className}`}>{badge.label}</span>}
    </p>
  );
}

export default function ForumThreadPage() {
  const { id = "" } = useParams();
  const [thread, setThread] = useState<Thread | null | undefined>(undefined); // undefined = loading, null = not found
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [event, setEvent] = useState<VolunteerEvent | null>(null);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getForumThread(id)
      .then((t) => {
        if (cancelled) return;
        setThread(t);
        const eventId = t?.post.linkedEventId;
        if (eventId) {
          getVolunteerEvents()
            .then((all) => !cancelled && setEvent(all.find((e) => e.id === eventId) ?? null))
            .catch(() => {});
        }
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  function toggleGoing(eventId: string) {
    const on = !event?.going;
    setEvent((e) => (e ? { ...e, going: on } : e));
    setGoing(eventId, on).catch(() => setEvent((e) => (e ? { ...e, going: !on } : e)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = reply.trim();
    if (!text || sending || !thread) return;
    setSending(true);
    setSendError(null);
    try {
      const r = await createForumReply(thread.post.id, text);
      setThread((t) => (t ? { ...t, replies: [...t.replies, r] } : t));
      setReply("");
    } catch {
      setSendError("Couldn't send your reply. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <header className="home-header">
        <div className="top-bar">
          <Link className="icon-button" to="/forum" aria-label="Back to the forum">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="header-title">{thread ? thread.post.localArea : "Forum"}</h1>
          <span aria-hidden="true" />
        </div>
      </header>

      <main className="page-content">
        {thread === undefined && !error && <div className="post-card skeleton" style={{ height: 180 }} aria-busy="true" />}

        {error && (
          <div className="empty" role="alert">
            <p>Couldn't load this post. Check your connection and try again.</p>
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

        {thread === null && (
          <div className="empty">
            <p>This post doesn't exist or was removed.</p>
            <Link className="chip-button" to="/forum">
              Back to the forum
            </Link>
          </div>
        )}

        {thread && (
          <>
            <article className="thread-post">
              {thread.post.sample && <span className="sample-tag">Sample</span>}
              <h2>{thread.post.title}</h2>
              <Author name={thread.post.author} kind={thread.post.authorKind} createdAt={thread.post.createdAt} />
              <p className="thread-body">{thread.post.body}</p>
            </article>

            {event && (
              <section className="thread-event" aria-label="The event this post is about">
                <h3 className="section-label">About this event</h3>
                <VolunteerCard event={event} going={Boolean(event.going)} onToggleGoing={toggleGoing} />
              </section>
            )}

            <section aria-label="Replies">
              <h3 className="section-label">
                {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
              </h3>
              <ul className="reply-list">
                {thread.replies.map((r) => (
                  <li key={r.id} className="reply">
                    <Author name={r.author} kind={r.authorKind} createdAt={r.createdAt} />
                    <p className="thread-body">{r.body}</p>
                  </li>
                ))}
              </ul>
            </section>

            <form className="composer reply-form" onSubmit={submit}>
              <label>
                <span className="visually-hidden">Your reply</span>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={REPLY_MAX}
                  rows={3}
                  placeholder="Write a reply"
                  required
                />
              </label>
              {sendError && (
                <p className="form-error" role="alert">
                  <TriangleAlert size={16} aria-hidden="true" />
                  {sendError}
                </p>
              )}
              <button className="action-button" type="submit" disabled={sending || !reply.trim()}>
                {sending ? "Sending…" : "Reply"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
