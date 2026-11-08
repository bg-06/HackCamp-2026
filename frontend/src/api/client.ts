// Every call to the backend goes through this file.
//
// Backend team: replace the parts marked TODO(backend). Pages and components
// don't need to change, as long as these functions keep returning the types
// in src/types.ts. If the backend uses different field names, convert them here.
//
// Mock mode is on by default. Set VITE_USE_MOCK=false in .env to use the real API.

import { FORUM_POSTS, FORUM_REPLIES } from "../data/mockForum";
import { TRACK2_ISSUES, VOLUNTEER_EVENTS } from "../data/mockData";
import type { ForumPost, ForumReply, Track2Issue, VolunteerEvent, Vote } from "../types";

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
  return request<VolunteerEvent>(`/events/${encodeURIComponent(id)}`);
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

/** RSVP to an in-app event (kind "hotspot", or an org event with spots). Needs sign-in. */
export async function setGoing(eventId: string, on: boolean): Promise<void> {
  if (USE_MOCK) {
    const e = VOLUNTEER_EVENTS.find((x) => x.id === eventId);
    if (e) e.going = on; // kept until reload, so Home and the event page agree
    return;
  }
  // TODO(backend): insert or delete the user's row in `rsvps`.
  await request<void>(`/events/${encodeURIComponent(eventId)}/rsvp`, {
    method: on ? "POST" : "DELETE",
  });
}

// ---------- Forum ----------

// Shown as the author in mock mode, until Auth0 sign-in gives us the real name.
const MOCK_ME = { author: "You", authorKind: "resident" as const };

/** All threads, newest first. The page filters by neighbourhood. */
export async function getForumPosts(): Promise<ForumPost[]> {
  if (USE_MOCK) {
    await wait(300);
    return [...FORUM_POSTS].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  // TODO(backend): GET /forum/posts → forum_posts with a reply count, newest first.
  return request<ForumPost[]>("/forum/posts");
}

/** One thread and its replies, oldest reply first. */
export async function getForumThread(postId: string): Promise<{ post: ForumPost; replies: ForumReply[] } | null> {
  if (USE_MOCK) {
    await wait(200);
    const post = FORUM_POSTS.find((p) => p.id === postId);
    if (!post) return null;
    const replies = FORUM_REPLIES.filter((r) => r.postId === postId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { post, replies };
  }
  // TODO(backend): GET /forum/posts/:id → { post, replies }, 404 → null.
  return request<{ post: ForumPost; replies: ForumReply[] }>(`/forum/posts/${encodeURIComponent(postId)}`);
}

/** Start a thread as the signed-in resident. */
export async function createForumPost(input: { localArea: string; title: string; body: string }): Promise<ForumPost> {
  if (USE_MOCK) {
    await wait(200);
    const post: ForumPost = {
      id: `local-${Date.now()}`,
      ...input,
      ...MOCK_ME,
      createdAt: new Date().toISOString(),
      replyCount: 0,
      sample: false,
    };
    FORUM_POSTS.unshift(post);
    return post;
  }
  // TODO(backend): POST /forum/posts. Needs sign-in; author comes from the session, never the request body.
  return request<ForumPost>("/forum/posts", { method: "POST", body: JSON.stringify(input) });
}

/** Reply to a thread as the signed-in resident. */
export async function createForumReply(postId: string, body: string): Promise<ForumReply> {
  if (USE_MOCK) {
    await wait(200);
    const reply: ForumReply = { id: `local-${Date.now()}`, postId, body, ...MOCK_ME, createdAt: new Date().toISOString() };
    FORUM_REPLIES.push(reply);
    const post = FORUM_POSTS.find((p) => p.id === postId);
    if (post) post.replyCount += 1;
    return reply;
  }
  // TODO(backend): POST /forum/posts/:id/replies. Needs sign-in.
  return request<ForumReply>(`/forum/posts/${encodeURIComponent(postId)}/replies`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
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
