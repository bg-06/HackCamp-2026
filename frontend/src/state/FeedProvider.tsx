import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getTrack2Issues, getVolunteerEvents, setGoing as saveGoing, setVote } from "../api/client";
import type { LocateStatus } from "../components/LocationSheet";
import { DEFAULT_CITY, inVancouver, type City } from "../lib/geo";
import type { FeedTab, LatLng, SortKey, Track2Issue, VolunteerEvent, Vote } from "../types";
import { FeedContext, type Loaded } from "./feed";

function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function FeedProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Loaded<VolunteerEvent>>({});
  const [issues, setIssues] = useState<Loaded<Track2Issue>>({});
  const [reloadKey, setReloadKey] = useState(0);

  const [city, setCity] = useState<City>(DEFAULT_CITY);
  const [here, setHere] = useState<LatLng | null>(null);
  const [locStatus, setLocStatus] = useState<LocateStatus>("idle");

  const [eventSort, setEventSort] = useState<SortKey>("recommended");
  const [issueSort, setIssueSort] = useState<SortKey>("recommended");
  const [query, setQueries] = useState<Record<FeedTab, string>>({ volunteer: "", issues: "" });
  const [searchOpen, setSearchOpens] = useState<Record<FeedTab, boolean>>({ volunteer: false, issues: false });
  const setQuery = useCallback((tab: FeedTab, q: string) => setQueries((prev) => ({ ...prev, [tab]: q })), []);
  const setSearchOpen = useCallback((tab: FeedTab, open: boolean) => setSearchOpens((prev) => ({ ...prev, [tab]: open })), []);
  const scrollTop = useRef<Record<FeedTab, number>>({ volunteer: 0, issues: 0 });
  const getScroll = useCallback((tab: FeedTab) => scrollTop.current[tab], []);
  const saveScroll = useCallback((tab: FeedTab, top: number) => {
    scrollTop.current[tab] = top;
  }, []);

  useEffect(() => {
    let cancelled = false;
    getVolunteerEvents()
      // Finished dated events drop off; ongoing opportunities have no end date and remain visible.
      .then((items) => !cancelled && setEvents({ items: items.filter((e) => e.endsAt === null || Date.parse(e.endsAt) > Date.now()) }))
      .catch((e: unknown) => !cancelled && setEvents({ error: errorText(e) }));
    getTrack2Issues()
      .then((items) => !cancelled && setIssues({ items }))
      .catch((e: unknown) => !cancelled && setIssues({ error: errorText(e) }));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setEvents({});
    setIssues({});
    setReloadKey((k) => k + 1);
  }, []);

  // Only asked for when the user taps something that needs it.
  const locate = useCallback(() => {
    if (!window.isSecureContext) {
      setLocStatus("insecure");
      return;
    }
    if (!("geolocation" in navigator)) {
      setLocStatus("unavailable");
      return;
    }
    setLocStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setHere(p);
        if (inVancouver(p)) {
          setCity(DEFAULT_CITY);
          setLocStatus("found");
        } else {
          setLocStatus("outside");
        }
      },
      (err) => setLocStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // Numbers each tap per item. A failed request only undoes itself if it was the last tap, so a slow
  // failure can't wipe out a vote the user made after it.
  const lastTap = useRef<Record<string, number>>({});
  const tap = (key: string) => (lastTap.current[key] = (lastTap.current[key] ?? 0) + 1);

  const setMyVote = useCallback(
    (issueId: string, value: Vote) => {
      const before = issues.items?.find((i) => i.issue_id === issueId)?.my_vote ?? 0;
      const apply = (v: Vote) =>
        setIssues((prev) => ({ ...prev, items: prev.items?.map((i) => (i.issue_id === issueId ? { ...i, my_vote: v } : i)) }));
      const n = tap(`vote:${issueId}`);
      apply(value);
      return setVote(issueId, value).then(
        () => true,
        () => {
          if (lastTap.current[`vote:${issueId}`] === n) apply(before);
          return false;
        },
      );
    },
    [issues.items],
  );

  const setGoing = useCallback((eventId: string, on: boolean) => {
    const apply = (v: boolean) =>
      setEvents((prev) => ({ ...prev, items: prev.items?.map((e) => (e.id === eventId ? { ...e, going: v } : e)) }));
    const n = tap(`going:${eventId}`);
    apply(on);
    return saveGoing(eventId, on).then(
      () => true,
      () => {
        if (lastTap.current[`going:${eventId}`] === n) apply(!on);
        return false;
      },
    );
  }, []);

  return (
    <FeedContext.Provider
      value={{
        events,
        issues,
        reload,
        city,
        setCity,
        here,
        locStatus,
        locate,
        eventSort,
        setEventSort,
        issueSort,
        setIssueSort,
        query,
        setQuery,
        searchOpen,
        setSearchOpen,
        getScroll,
        saveScroll,
        setMyVote,
        setGoing,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
}
