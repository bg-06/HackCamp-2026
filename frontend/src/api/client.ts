// Every call to the backend goes through this file.
//
// Backend team: replace the parts marked TODO(backend). Pages and components
// don't need to change, as long as these functions keep returning the types
// in src/types.ts. If the backend uses different field names (for example
// `local_area` instead of `area`), convert them here.
//
// Mock mode is on by default. Set VITE_USE_MOCK=false in .env to use the real API.

import { EVENTS, ISSUES } from "../data/mockPosts";
import type { EventPost, IssuePost } from "../types";

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
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

/** Open City 311 cases and resident reports for the Issues tab. */
export async function getIssues(): Promise<IssuePost[]> {
  if (USE_MOCK) {
    await wait(300);
    return ISSUES;
  }
  // TODO(backend): GET /issues → rows from gold.cases_enriched, mapped to IssuePost.
  return request<IssuePost[]>("/issues");
}

/** Community events for the Events tab. */
export async function getEvents(): Promise<EventPost[]> {
  if (USE_MOCK) {
    await wait(300);
    return EVENTS;
  }
  // TODO(backend): GET /events → events created in the app, mapped to EventPost.
  return request<EventPost[]>("/events");
}

/** Add or remove the current user's "Me too" on an issue. */
export async function setMeToo(issueId: string, on: boolean): Promise<void> {
  if (USE_MOCK) return;
  // TODO(backend): write to the votes collection (one vote per user).
  await request<void>(`/issues/${encodeURIComponent(issueId)}/me-too`, {
    method: on ? "POST" : "DELETE",
  });
}

/** Join or leave an event. */
export async function setGoing(eventId: string, on: boolean): Promise<void> {
  if (USE_MOCK) return;
  // TODO(backend): save the RSVP for the current user.
  await request<void>(`/events/${encodeURIComponent(eventId)}/going`, {
    method: on ? "POST" : "DELETE",
  });
}
