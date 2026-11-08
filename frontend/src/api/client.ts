// Every call to the backend goes through this file.
//
// Backend team: replace the parts marked TODO(backend). Pages and components
// don't need to change, as long as these functions keep returning the types
// in src/types.ts. If the backend uses different field names, convert them here.
//
// Mock mode is on by default. Set VITE_USE_MOCK=false in .env to use the real API.

import { COMMENTS } from "../data/mockComments";
import { TRACK2_ISSUES, VOLUNTEER_EVENTS } from "../data/mockData";
import type { Comment, CommentTarget, Track2Issue, VolunteerEvent, Vote } from "../types";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Like request(), but a 404 means "doesn't exist" and returns null instead of throwing. */
async function requestOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { "Content-Type": "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

/** Track 1: City events, local org events and events started from a hotspot. */
export async function getVolunteerEvents(): Promise<VolunteerEvent[]> {
  if (USE_MOCK) {
    await wait(300);
    return VOLUNTEER_EVENTS.map((e) => ({ ...e }));
  }
  // TODO(backend): GET /events → seed events + the app's `events` table, mapped to VolunteerEvent,
  // with lat/lng, createdAt, popularity (searches + opens) and the current user's `going`.
  return request<VolunteerEvent[]>("/events");
}

/** One event, or null if it doesn't exist. */
export async function getVolunteerEvent(id: string): Promise<VolunteerEvent | null> {
  if (USE_MOCK) {
    await wait(150);
    const e = VOLUNTEER_EVENTS.find((x) => x.id === id);
    return e ? { ...e } : null;
  }
  // TODO(backend): GET /events/:id, 404 → null.
  return requestOrNull<VolunteerEvent>(`/events/${encodeURIComponent(id)}`);
}

/** Track 2: issues only the City can fix, with vote counts and the current user's vote. */
export async function getTrack2Issues(): Promise<Track2Issue[]> {
  if (USE_MOCK) {
    await wait(300);
    return TRACK2_ISSUES.map((i) => ({ ...i }));
  }
  // TODO(backend): GET /issues → gold_track2_issues joined with `votes`.
  // up_votes/down_votes should NOT include the current user's vote; that goes in my_vote.
  return request<Track2Issue[]>("/issues");
}

/** One issue, or null if it doesn't exist (for example, the City closed it). */
export async function getTrack2Issue(id: string): Promise<Track2Issue | null> {
  if (USE_MOCK) {
    await wait(150);
    const i = TRACK2_ISSUES.find((x) => x.issue_id === id);
    return i ? { ...i } : null;
  }
  // TODO(backend): GET /issues/:id, 404 → null.
  return requestOrNull<Track2Issue>(`/issues/${encodeURIComponent(id)}`);
}

/** RSVP to an in-app event (kind "hotspot", or an org event with spots). Needs sign-in. */
export async function setGoing(eventId: string, on: boolean): Promise<void> {
  if (USE_MOCK) {
    const e = VOLUNTEER_EVENTS.find((x) => x.id === eventId);
    if (e) e.going = on; // kept until reload, so the feed and the detail page agree
    return;
  }
  // TODO(backend): insert or delete the user's row in `rsvps`.
  await request<void>(`/events/${encodeURIComponent(eventId)}/rsvp`, {
    method: on ? "POST" : "DELETE",
  });
}

// ---------- Comments (the discussion under each post) ----------

// Shown as the author in mock mode, until Auth0 sign-in gives us the real name.
const MOCK_ME = { author: "You", authorKind: "resident" as const };

const commentsPath = (type: CommentTarget, id: string) =>
  `/${type === "event" ? "events" : "issues"}/${encodeURIComponent(id)}/comments`;

/** Comments on one volunteer opportunity or issue, oldest first. */
export async function getComments(type: CommentTarget, id: string): Promise<Comment[]> {
  if (USE_MOCK) {
    await wait(200);
    return COMMENTS.filter((c) => c.targetType === type && c.targetId === id).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }
  // TODO(backend): GET /events/:id/comments or /issues/:id/comments, from the `comments` table, oldest first.
  return request<Comment[]>(commentsPath(type, id));
}

/** Add a comment as the signed-in resident. */
export async function addComment(type: CommentTarget, id: string, body: string): Promise<Comment> {
  if (USE_MOCK) {
    await wait(200);
    const c: Comment = { id: `local-${Date.now()}`, targetType: type, targetId: id, body, ...MOCK_ME, createdAt: new Date().toISOString() };
    COMMENTS.push(c);
    return c;
  }
  // TODO(backend): POST /events/:id/comments or /issues/:id/comments with { body }.
  // Needs sign-in. The author comes from the session, never from the request body.
  return request<Comment>(commentsPath(type, id), { method: "POST", body: JSON.stringify({ body }) });
}

/** Up (1), down (-1) or clear (0) the current user's vote. One vote per user per issue. */
export async function setVote(issueId: string, value: Vote): Promise<void> {
  if (USE_MOCK) {
    const i = TRACK2_ISSUES.find((x) => x.issue_id === issueId);
    if (i) i.my_vote = value;
    return;
  }
  // TODO(backend): upsert into `votes` (UNIQUE user_id, issue_id), or delete when value is 0.
  await request<void>(`/issues/${encodeURIComponent(issueId)}/vote`, {
    method: value === 0 ? "DELETE" : "PUT",
    body: value === 0 ? undefined : JSON.stringify({ value }),
  });
}
