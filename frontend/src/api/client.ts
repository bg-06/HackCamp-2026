// Every call to the backend goes through this file.
//
// Pages and components only depend on the types returned here. The Postgres-backed API is the
// default; set VITE_USE_MOCK=true (or run npm run dev:mock) for isolated UI work.

import { COMMENTS } from "../data/mockComments";
import { HELP_HOTSPOTS, MY_HISTORY, TRACK2_ISSUES, VOLUNTEER_EVENTS } from "../data/mockData";
import { DAILY_VOTES } from "../lib/issues";
import type { Comment, CommentTarget, HelpHotspot, NewEvent, Track2Issue, VolunteerEvent, VolunteerRecord, Vote, VoteBudget } from "../types";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Give up after 15 s so a stuck request shows "Try again" instead of loading forever
const TIMEOUT_MS = 15000;

// Set by AuthProvider while someone is signed in with Auth0. Returns an access token for our API.
let getAccessToken: (() => Promise<string | undefined>) | null = null;
export function setAccessTokenGetter(getter: (() => Promise<string | undefined>) | null) {
  getAccessToken = getter;
}

/** Sent on every call while signed in: writes need it, and reads use it for your votes and RSVPs. */
async function authHeaders(): Promise<Record<string, string>> {
  if (!getAccessToken) return {};
  try {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    // Session expired or couldn't renew: send nothing, so public reads still work and writes get a 401.
    return {};
  }
}

// A failed request. `body` is the parsed JSON error, if there was one (the vote limit sends its numbers there).
// status 401 = sign in again, 403 = not allowed, 503 = try again later.
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body?: unknown) {
    super(
      status === 401
        ? "Please sign in again"
        : status === 403
          ? "You don't have permission to do that"
          : `Request failed (${status})`,
    );
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
    headers: { "Content-Type": "application/json", ...(await authHeaders()), ...init?.headers },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => undefined));
  // A 200/201 with an empty body is still a success (common for PUT and POST)
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Like request(), but a 404 means "doesn't exist" and returns null instead of throwing. */
async function requestOrNull<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await request<T>(path, init);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

const countComments = (type: CommentTarget, id: string) => COMMENTS.filter((c) => c.targetType === type && c.targetId === id).length;

function resolveApiAsset(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function normalizeEvent(event: VolunteerEvent): VolunteerEvent {
  return event.photoUrl ? { ...event, photoUrl: resolveApiAsset(event.photoUrl) } : event;
}

/** Track 1: City events, local org events and events started from a hotspot. */
export async function getVolunteerEvents(): Promise<VolunteerEvent[]> {
  if (USE_MOCK) {
    await wait(300);
    return VOLUNTEER_EVENTS.map((e) => ({ ...e, commentCount: countComments("event", e.id) }));
  }
  return (await request<VolunteerEvent[]>("/events")).map(normalizeEvent);
}

/** Spots that keep getting reported and neighbours could clean up, from gold_help_hotspots. */
export async function getHelpHotspots(): Promise<HelpHotspot[]> {
  if (USE_MOCK) {
    await wait(300);
    return HELP_HOTSPOTS.map((h) => ({ ...h }));
  }
  // GET /hotspots → gold_help_hotspots with lat/lng (H3 cell centre), most reported first.
  return request<HelpHotspot[]>("/hotspots");
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
  return normalizeEvent(await request<VolunteerEvent>("/events", { method: "POST", body: JSON.stringify(input) }));
}

/** One event, or null if it doesn't exist. */
export async function getVolunteerEvent(id: string): Promise<VolunteerEvent | null> {
  if (USE_MOCK) {
    await wait(150);
    const e = VOLUNTEER_EVENTS.find((x) => x.id === id);
    return e ? { ...e } : null;
  }
  const event = await requestOrNull<VolunteerEvent>(`/events/${encodeURIComponent(id)}`);
  return event ? normalizeEvent(event) : null;
}

/** Track 2: issues only the City can fix, with vote counts and the current user's vote. */
export async function getTrack2Issues(): Promise<Track2Issue[]> {
  if (USE_MOCK) {
    await wait(300);
    return TRACK2_ISSUES.map((i) => ({ ...i, comment_count: countComments("issue", i.issue_id) }));
  }
  // up_votes leaves out the current user's vote; that's my_vote.
  // The whole list (~3,000 issues): distance sort, "longest open" and search all run here in the browser,
  // so a top-N cut would hide nearby or old issues that just don't score high.
  return request<Track2Issue[]>("/issues");
}

/** One issue, or null if it doesn't exist (for example, the City closed it). */
export async function getTrack2Issue(id: string): Promise<Track2Issue | null> {
  if (USE_MOCK) {
    await wait(150);
    const i = TRACK2_ISSUES.find((x) => x.issue_id === id);
    return i ? { ...i } : null;
  }
  return requestOrNull<Track2Issue>(`/issues/${encodeURIComponent(id)}`);
}

/** RSVP to an in-app event (kind "hotspot", or an org event with spots). Needs sign-in. */
export async function setGoing(eventId: string, on: boolean): Promise<void> {
  if (USE_MOCK) {
    const e = VOLUNTEER_EVENTS.find((x) => x.id === eventId);
    if (e) e.going = on; // kept until reload, so the feed and the detail page agree
    return;
  }
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
  return request<VolunteerRecord[]>("/me/history");
}

/** Sets the name shown on your comments and the events you host. Real API only. */
export async function saveDisplayName(displayName: string): Promise<void> {
  if (USE_MOCK) return;
  await request<{ displayName: string }>("/me/profile", { method: "PUT", body: JSON.stringify({ displayName }) });
}

// ---------- Comments (the discussion under each post) ----------

// Shown as the author in mock mode. With Auth0 the backend uses your saved display name.
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
  return request<Comment>(commentsPath(type, id), { method: "POST", body: JSON.stringify({ body }) });
}

// Mock mode uses the same active-vote limit as the API.
const mockBudget = (): VoteBudget => {
  const mockVotesUsed = TRACK2_ISSUES.filter(i => i.my_vote === 1).length;
  return {
    limit: DAILY_VOTES,
    votesUsed: mockVotesUsed,
    votesRemaining: Math.max(DAILY_VOTES - mockVotesUsed, 0),
  };
};

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
    if (!i) throw new ApiError(404, { error: "Issue not found" });
    const budget = mockBudget();
    if (value === 1 && i.my_vote !== 1) {
      if (budget.votesRemaining === 0) throw new ApiError(429, { code: "VOTE_LIMIT", ...budget });
    }
    i.my_vote = value;
    return mockBudget();
  }
  return request<VoteBudget>(`/issues/${encodeURIComponent(issueId)}/vote`, {
    method: value === 0 ? "DELETE" : "PUT",
    body: value === 0 ? undefined : JSON.stringify({ value }),
  });
}

export async function swapVote(issueId: string, removeIssueId: string, expectedIssueIds: string[]): Promise<VoteBudget> {
  if (USE_MOCK) {
    const active = TRACK2_ISSUES.filter(i => i.my_vote === 1);
    const target = TRACK2_ISSUES.find(i => i.issue_id === issueId);
    const removed = active.find(i => i.issue_id === removeIssueId);
    if (!target || !removed || active.length !== 2 || active.some(i => !expectedIssueIds.includes(i.issue_id))) throw new ApiError(409, { error: "Your votes changed" });
    removed.my_vote = 0;
    target.my_vote = 1;
    return mockBudget();
  }
  return request<VoteBudget>(`/issues/${encodeURIComponent(issueId)}/vote/swap`, {
    method: "POST", body: JSON.stringify({ removeIssueId, expectedIssueIds }),
  });
}
