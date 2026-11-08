// Every call to the backend goes through this file.
//
// Pages and components only depend on the types returned here. The Postgres-backed API is the
// default; set VITE_USE_MOCK=true (or run npm run dev:mock) for isolated UI work.

import { COMMENTS } from "../data/mockComments";
import { HELP_HOTSPOTS, MY_HISTORY, TRACK2_ISSUES, VOLUNTEER_EVENTS } from "../data/mockData";
import type { Comment, CommentTarget, HelpHotspot, NewEvent, Track2Issue, VolunteerEvent, VolunteerRecord, Vote } from "../types";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Give up after 15 s so a stuck request shows "Try again" instead of loading forever
const TIMEOUT_MS = 15000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
    // merged, so adding an Authorization header later doesn't drop the content type
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
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

/** Up (1), down (-1) or clear (0) the current user's vote. One vote per user per issue. */
export async function setVote(issueId: string, value: Vote): Promise<void> {
  if (USE_MOCK) {
    const i = TRACK2_ISSUES.find((x) => x.issue_id === issueId);
    if (i) i.my_vote = value;
    return;
  }
  await request<void>(`/issues/${encodeURIComponent(issueId)}/vote`, {
    method: value === 0 ? "DELETE" : "PUT",
    body: value === 0 ? undefined : JSON.stringify({ value }),
  });
}
