import { createContext, useContext } from "react";
import type { LocateStatus } from "../components/LocationSheet";
import type { City } from "../lib/geo";
import type { FeedTab, LatLng, SortKey, Track2Issue, VolunteerEvent, Vote } from "../types";

// No items and no error = still loading.
export interface Loaded<T> {
  items?: T[];
  error?: string;
}

// Lives above the routes, so opening a card and coming back keeps the lists, location, sort and scroll.
export interface Feed {
  events: Loaded<VolunteerEvent>;
  issues: Loaded<Track2Issue>;
  reload: () => void;

  city: City;
  setCity: (c: City) => void;
  here: LatLng | null;
  locStatus: LocateStatus;
  locate: () => void;

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
  setGoing: (eventId: string, on: boolean) => Promise<boolean>;
}

export const FeedContext = createContext<Feed | null>(null);

export function useFeed() {
  const feed = useContext(FeedContext);
  if (!feed) throw new Error("useFeed must be used inside <FeedProvider>");
  return feed;
}
