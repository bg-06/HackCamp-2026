// Every call to the backend goes through this file.
//
// Backend team: replace the parts marked TODO(backend). Pages and components
// don't need to change, as long as these functions keep returning the types
// in src/types.ts. If the backend uses different field names, convert them here.
//
// Mock mode is on by default. Set VITE_USE_MOCK=false in .env to use the real API.

import { COMMENTS } from "../data/mockComments";
import { HELP_HOTSPOTS, MY_HISTORY, TRACK2_ISSUES, VOLUNTEER_EVENTS } from "../data/mockData";
import type { Comment, CommentTarget, HelpHotspot, NewEvent, Track2Issue, VolunteerEvent, VolunteerRecord, Vote, VoteBudget } from "../types";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Give up after 15 s so a stuck request shows "Try again" instead of loading forever
const TIMEOUT_MS = 15000;

// A failed request. `body` is the parsed JSON error, if there was one (the vote limit sends its numbers there).
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body?: unknown) {
    super(`Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
    // merged, so adding an Authorization header later doesn't drop the content type
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => undefined));
  // A 200/201 with an empty body is still a success (common for PUT and POST)
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Like request(), but a 404 means "doesn't exist" and returns null instead of throwing. */
async function requestOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

const countComments = (type: CommentTarget, id: string) => COMMENTS.filter((c) => c.targetType === type && c.targetId === id).length;

/** Track 1: City events, local org events and events started from a hotspot. */
export async function getVolunteerEvents(): Promise<VolunteerEvent[]> {
  if (USE_MOCK) {
    await wait(300);
    return VOLUNTEER_EVENTS.map((e) => ({ ...e, commentCount: countComments("event", e.id) }));
  }
  // TODO(backend): GET /events → seed events + the app's `events` table, mapped to VolunteerEvent,
  // with lat/lng, createdAt, popularity (searches + opens), commentCount, hotspotId and the current user's `going`.
  return request<VolunteerEvent[]>("/events");
}

/** Spots that keep getting reported and neighbours could clean up, from gold_help_hotspots. */
export async function getHelpHotspots(): Promise<HelpHotspot[]> {
  if (USE_MOCK) {
    await wait(300);
    return HELP_HOTSPOTS.map((h) => ({ ...h }));
  }
  // TODO(backend): GET /hotspots → gold_help_hotspots with lat/lng (H3 cell centre), most reported first.
  // until the API has this route, a 404 just means no "Needs help" list
  return (await requestOrNull<HelpHotspot[]>("/hotspots")) ?? [];
}

/** Start an event, usually from a hotspot. The signed-in user is the host. */
export async function createEvent(input: NewEvent): Promise<VolunteerEvent> {
  if (USE_MOCK) {
    await wait(300);
    const e: VolunteerEvent = {
      ...input,
      id: `local-event-${VOLUNTEER_EVENTS.length}-${Date.now()}`,
      kind: "hotspot",
      organiser: "You",
      spotsTaken: 0,
      going: true, // the host counts as going
      sample: false,
      createdAt: new Date().toISOString(),
      popularity: 0,
      commentCount: 0,
    };
    VOLUNTEER_EVENTS.push(e);
    return { ...e };
  }
  // TODO(backend): POST /events. Needs sign-in; the organiser comes from the session.
  // Then call the n8n "new event" webhook (plan.md section 9).
  return request<VolunteerEvent>("/events", { method: "POST", body: JSON.stringify(input) });
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
    return TRACK2_ISSUES.map((i) => ({ ...i, comment_count: countComments("issue", i.issue_id) }));
  }
  // up_votes leaves out the current user's vote; that's my_vote.
  // The full list is ~3,000 issues (1.2 MB). The API sends them most pressing first, so the top 500 is plenty.
  return request<Track2Issue[]>("/issues?limit=500");
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

/** What the signed-in user has already volunteered at, newest first. */
export async function getMyHistory(): Promise<VolunteerRecord[]> {
  if (USE_MOCK) {
    await wait(200);
    return [...MY_HISTORY].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }
  // TODO(backend): GET /me/history → the user's rsvps on events with done_at set.
  // hours = the host's count if they recorded one, otherwise the event's length.
  return (await requestOrNull<VolunteerRecord[]>("/me/history")) ?? [];
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
    return COMMENTS.filter((c) => c.targetType === type && c.targetId === id).sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt), // not string order: offsets differ
    );
  }
  // TODO(backend): GET /events/:id/comments or /issues/:id/comments, from the `comments` table, oldest first.
  return request<Comment[]>(commentsPath(type, id));
}

/** Add a comment as the signed-in resident. */
export async function addComment(type: CommentTarget, id: string, body: string): Promise<Comment> {
  if (USE_MOCK) {
    await wait(200);
    const c: Comment = { id: `local-${COMMENTS.length}-${Date.now()}`, targetType: type, targetId: id, body, ...MOCK_ME, createdAt: new Date().toISOString() };
    COMMENTS.push(c);
    return c;
  }
  // TODO(backend): POST /events/:id/comments or /issues/:id/comments with { body }.
  // Needs sign-in. The author comes from the session, never from the request body.
  return request<Comment>(commentsPath(type, id), { method: "POST", body: JSON.stringify({ body }) });
}

// Mock mode keeps the daily count here, in memory.
let mockVotesUsed = 0;
const mockBudget = (): VoteBudget => ({
  dailyLimit: 2,
  votesUsed: mockVotesUsed,
  votesRemaining: Math.max(2 - mockVotesUsed, 0),
  voteDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" }),
  resetsAt: "",
});

/** How many votes the user has left today. */
export async function getVoteBudget(): Promise<VoteBudget> {
  if (USE_MOCK) return mockBudget();
  return request<VoteBudget>("/me/votes");
}

/**
 * Up vote (1) or take it back (0). Taking it back doesn't refund the day's vote.
 * Over the daily limit this throws an ApiError with status 429 and the budget in `body`.
 */
export async function setVote(issueId: string, value: Vote): Promise<VoteBudget> {
  if (USE_MOCK) {
    const i = TRACK2_ISSUES.find((x) => x.issue_id === issueId);
    if (value === 1 && i?.my_vote !== 1) {
      if (mockVotesUsed >= 2) throw new ApiError(429, { code: "DAILY_VOTE_LIMIT", ...mockBudget() });
      mockVotesUsed++;
    }
    if (i) i.my_vote = value;
    return mockBudget();
  }
  return request<VoteBudget>(`/issues/${encodeURIComponent(issueId)}/vote`, {
    method: value === 0 ? "DELETE" : "PUT",
    body: value === 0 ? undefined : JSON.stringify({ value }),
  });
}
