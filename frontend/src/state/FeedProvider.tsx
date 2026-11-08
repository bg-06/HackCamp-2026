import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getHelpHotspots, getTrack2Issues, getVolunteerEvents, setGoing as saveGoing, setVote } from "../api/client";
import { inVancouver } from "../lib/geo";
import type { CommentTarget, FeedTab, HelpHotspot, LatLng, SortKey, Track2Issue, VolunteerEvent, Vote } from "../types";
import { FeedContext, type Loaded, type LocateStatus } from "./feed";

function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function FeedProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Loaded<VolunteerEvent>>({});
  const [issues, setIssues] = useState<Loaded<Track2Issue>>({});
  const [hotspots, setHotspots] = useState<Loaded<HelpHotspot>>({});
  const [reloadKey, setReloadKey] = useState(0);

  const [here, setHere] = useState<LatLng | null>(null);
  const [locStatus, setLocStatus] = useState<LocateStatus>("off");

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
      // Finished dated events drop off; undated programs are ongoing and stay visible.
      .then((items) => !cancelled && setEvents({ items: items.filter((e) => !e.endsAt || Date.parse(e.endsAt) > Date.now()) }))
      .catch((e: unknown) => !cancelled && setEvents({ error: errorText(e) }));
    getTrack2Issues()
      .then((items) => !cancelled && setIssues({ items }))
      .catch((e: unknown) => !cancelled && setIssues({ error: errorText(e) }));
    getHelpHotspots()
      .then((items) => !cancelled && setHotspots({ items }))
      .catch((e: unknown) => !cancelled && setHotspots({ error: errorText(e) }));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setEvents({});
    setIssues({});
    setHotspots({});
    setReloadKey((k) => k + 1);
  }, []);

  const addEvent = useCallback((e: VolunteerEvent) => {
    setEvents((prev) => ({ ...prev, items: [e, ...(prev.items ?? [])] }));
  }, []);

  const commentAdded = useCallback((type: CommentTarget, id: string) => {
    if (type === "event")
      setEvents((prev) => ({ ...prev, items: prev.items?.map((e) => (e.id === id ? { ...e, commentCount: (e.commentCount ?? 0) + 1 } : e)) }));
    else
      setIssues((prev) => ({
        ...prev,
        items: prev.items?.map((i) => (i.issue_id === id ? { ...i, comment_count: (i.comment_count ?? 0) + 1 } : i)),
      }));
  }, []);

  // Only asks for the position when the user turns "Near me" on.
  const toggleNearMe = useCallback(() => {
    if (here) {
      setHere(null);
      setLocStatus("off");
      return;
    }
    if (!window.isSecureContext) return setLocStatus("insecure");
    if (!("geolocation" in navigator)) return setLocStatus("unavailable");
    setLocStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setHere(p);
        setLocStatus(inVancouver(p) ? "on" : "outside");
      },
      (err) => setLocStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, [here]);

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

  // Sign-in. In mock mode "Sign in" just flips this flag.
  // TODO(auth): with Auth0, signIn() calls loginWithRedirect and keeps the pending action in appState,
  // since the page reloads after the redirect.
  const [signedIn, setSignedIn] = useState(false);
  const [signInPrompt, setSignInPrompt] = useState<string | null>(null);
  const pending = useRef<(() => void) | null>(null);

  const requireSignIn = useCallback(
    (reason: string, action: () => void) => {
      if (signedIn) return action();
      pending.current = action;
      setSignInPrompt(reason);
    },
    [signedIn],
  );
  const signIn = useCallback(() => {
    setSignedIn(true);
    setSignInPrompt(null);
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);
  const cancelSignIn = useCallback(() => {
    pending.current = null;
    setSignInPrompt(null);
  }, []);
  // Your votes and sign-ups belong to the account, so they go with it.
  // TODO(auth): Auth0 logout reloads the page, which does the same.
  const signOut = useCallback(() => {
    setSignedIn(false);
    setIssues((prev) => ({ ...prev, items: prev.items?.map((i) => ({ ...i, my_vote: 0 })) }));
    setEvents((prev) => ({ ...prev, items: prev.items?.map((e) => ({ ...e, going: false })) }));
  }, []);

  return (
    <FeedContext.Provider
      value={{
        events,
        issues,
        hotspots,
        reload,
        addEvent,
        commentAdded,
        here,
        locStatus,
        toggleNearMe,
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
        signedIn,
        requireSignIn,
        signIn,
        signOut,
        signInPrompt,
        cancelSignIn,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
}
