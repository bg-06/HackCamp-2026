import { createContext, useContext } from "react";
import type { CommentTarget, FeedTab, HelpHotspot, LatLng, SortKey, Track2Issue, VolunteerEvent, Vote, VoteBudget } from "../types";

// No items and no error = still loading.
export interface Loaded<T> {
  items?: T[];
  error?: string;
}

export type LocateStatus = "off" | "locating" | "on" | "outside" | "denied" | "unavailable" | "insecure";

// Lives above the routes, so opening a card and coming back keeps the lists, location, sort and scroll.
export interface Feed {
  events: Loaded<VolunteerEvent>;
  issues: Loaded<Track2Issue>;
  hotspots: Loaded<HelpHotspot>;
  reload: () => void;
  addEvent: (e: VolunteerEvent) => void;
  commentAdded: (type: CommentTarget, id: string) => void;

  // "Near me": your position if you turned it on, otherwise null
  here: LatLng | null;
  locStatus: LocateStatus;
  toggleNearMe: () => void;

  eventSort: SortKey;
  setEventSort: (s: SortKey) => void;
  issueSort: SortKey;
  setIssueSort: (s: SortKey) => void;
  // one search per tab, so a search on Issues doesn't empty the Volunteer feed
  query: Record<FeedTab, string>;
  setQuery: (tab: FeedTab, q: string) => void;
  searchOpen: Record<FeedTab, boolean>;
  setSearchOpen: (tab: FeedTab, open: boolean) => void;
  getScroll: (tab: FeedTab) => number;
  saveScroll: (tab: FeedTab, top: number) => void;

  // Update the list right away, then the backend. Resolves false (and undoes it) if the request failed.
  setMyVote: (issueId: string, value: Vote) => Promise<boolean>;
  voteBudget: VoteBudget | null; // null until loaded, or if the API can't say
  voteLimitHit: boolean; // the last vote was refused because today's votes are used up
  setGoing: (eventId: string, on: boolean) => Promise<boolean>;

  // Voting, signing up, commenting and starting an event need sign-in. requireSignIn runs the action
  // straight away if signed in; otherwise it asks first and runs it after sign-in.
  signedIn: boolean;
  requireSignIn: (reason: string, action: () => void) => void;
  signIn: () => void;
  signOut: () => void;
  signInPrompt: string | null; // the reason being asked for, while the prompt is open
  cancelSignIn: () => void;
}

export const FeedContext = createContext<Feed | null>(null);

export function useFeed() {
  const feed = useContext(FeedContext);
  if (!feed) throw new Error("useFeed must be used inside <FeedProvider>");
  return feed;
}
