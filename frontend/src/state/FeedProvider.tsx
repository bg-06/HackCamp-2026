import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, getHelpHotspots, getTrack2Issues, getVolunteerEvents, getVoteBudget, setGoing as saveGoing, setVote, swapVote, USE_MOCK } from "../api/client";
import VoteComparison from "../components/VoteComparison";
import { useAuth } from "./auth";
import { inVancouver } from "../lib/geo";
import type { CommentTarget, FeedTab, HelpHotspot, LatLng, SortKey, Track2Issue, VolunteerEvent, Vote, VoteBudget } from "../types";
import { FeedContext, type Loaded, type LocateStatus } from "./feed";

// The vote routes' JSON, or something else (an empty body, a proxy's error page)
function isBudget(x: unknown): x is VoteBudget {
  return typeof x === "object" && x !== null && typeof (x as VoteBudget).votesRemaining === "number";
}

// Issue rows drawn at a time. Thousands at once froze the page for seconds.
const ISSUE_PAGE = 50;

function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function FeedProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Loaded<VolunteerEvent>>({});
  const [issues, setIssues] = useState<Loaded<Track2Issue>>({});
  const [hotspots, setHotspots] = useState<Loaded<HelpHotspot>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [voteBudget, setVoteBudget] = useState<VoteBudget | null>(null);
  const [voteLimitHit, setVoteLimitHit] = useState(false);
  const [comparison, setComparison] = useState<[Track2Issue, Track2Issue, Track2Issue] | null>(null);
  const closeComparison = useCallback(() => setComparison(null), []);

  // Numbers each budget request. Only the latest one may set the budget, so a slow response
  // from an earlier vote can't put back a count that's already out of date.
  const budgetSeq = useRef(0);
  const refreshBudget = useCallback(() => {
    const seq = ++budgetSeq.current;
    // not worth an error message: without it the page just doesn't say how many votes are left
    getVoteBudget()
      .then((b) => seq === budgetSeq.current && setVoteBudget(b))
      .catch(() => {});
  }, []);

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
  const issueLimit = useRef({ key: "", n: ISSUE_PAGE });
  const getIssueLimit = useCallback((key: string) => (issueLimit.current.key === key ? issueLimit.current.n : ISSUE_PAGE), []);
  const saveIssueLimit = useCallback((key: string, n: number) => {
    issueLimit.current = { key, n };
  }, []);
  const saveScroll = useCallback((tab: FeedTab, top: number) => {
    scrollTop.current[tab] = top;
  }, []);

  const auth = useAuth();
  // With Auth0, wait until we know who you are, so the lists come with your votes and RSVPs.
  // (Signing in or out reloads the page, so this changes only once.) Mock sign-in doesn't refetch.
  const authKey = USE_MOCK ? "mock" : auth.ready ? String(auth.signedIn) : null;

  useEffect(() => {
    if (authKey === null) return;
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
    // /me/votes needs an account; signed out there's no budget to show
    if (authKey !== "false") refreshBudget();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, authKey, refreshBudget]);

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
    (issueId: string, value: Vote, issue?: Track2Issue) => {
      const selected = issues.items?.filter(i => i.my_vote === 1) ?? [];
      const target = issues.items?.find(i => i.issue_id === issueId) ?? issue;
      if (value === 1 && voteBudget?.votesRemaining === 0 && target && selected.length === 2 && !selected.some(i => i.issue_id === issueId)) {
        setComparison([selected[0], selected[1], target]);
        return Promise.resolve(false);
      }
      const before = issues.items?.find((i) => i.issue_id === issueId)?.my_vote ?? 0;
      const apply = (v: Vote) =>
        setIssues((prev) => ({ ...prev, items: prev.items?.map((i) => (i.issue_id === issueId ? { ...i, my_vote: v } : i)) }));
      const n = tap(`vote:${issueId}`);
      apply(value);
      setVoteLimitHit(false);
      const seq = ++budgetSeq.current;
      return setVote(issueId, value).then(
        (budget) => {
          if (isBudget(budget) && seq === budgetSeq.current) setVoteBudget(budget);
          return true;
        },
        (e: unknown) => {
          if (e instanceof ApiError && e.status === 429) {
            setVoteLimitHit(true);
            // the API sends the budget with the 429; if something else sent it, we still know none are left
            if (isBudget(e.body)) {
              if (seq === budgetSeq.current) setVoteBudget(e.body);
            } else setVoteBudget((prev) => (prev ? { ...prev, votesRemaining: 0 } : prev));
          } else if (seq === budgetSeq.current) refreshBudget();
          if (lastTap.current[`vote:${issueId}`] === n) apply(before);
          return false;
        },
      );
    },
    [issues.items, refreshBudget, voteBudget],
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

  // Sign-in. Mock mode signs in straight away and then runs what you tapped. Auth0 goes to its login
  // page and comes back to this page; the tap isn't replayed, since the page reloads.
  const { signedIn } = auth;
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
  const { login, logout } = auth;
  const signIn = useCallback(() => {
    setSignInPrompt(null);
    login();
    if (!USE_MOCK) return; // Auth0 leaves the page; the budget loads when it comes back
    refreshBudget();
    const action = pending.current;
    pending.current = null;
    action?.();
  }, [login, refreshBudget]);
  const cancelSignIn = useCallback(() => {
    pending.current = null;
    setSignInPrompt(null);
  }, []);
  // Your votes and sign-ups belong to the account, so they go with it.
  // Auth0 logout reloads the page, which does the same.
  const signOut = useCallback(() => {
    logout();
    budgetSeq.current++; // drop any budget still on its way for the old account
    setVoteBudget(null);
    setVoteLimitHit(false);
    setIssues((prev) => ({ ...prev, items: prev.items?.map((i) => ({ ...i, my_vote: 0 })) }));
    setEvents((prev) => ({ ...prev, items: prev.items?.map((e) => ({ ...e, going: false })) }));
  }, [logout]);

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
        getIssueLimit,
        saveIssueLimit,
        setMyVote,
        voteBudget,
        voteLimitHit,
        outOfVotes: signedIn && voteBudget?.votesRemaining === 0,
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
      {comparison && <VoteComparison choices={comparison} onClose={closeComparison} onConfirm={async (removeId) => {
        try {
          const seq = ++budgetSeq.current;
          const budget = await swapVote(comparison[2].issue_id, removeId, comparison.slice(0, 2).map(i => i.issue_id));
          setIssues(prev => {
            const items = prev.items?.map(i => i.issue_id === removeId ? { ...i, my_vote: 0 as const } : i.issue_id === comparison[2].issue_id ? { ...i, my_vote: 1 as const } : i);
            return { ...prev, items: items && !items.some(i => i.issue_id === comparison[2].issue_id) ? [...items, { ...comparison[2], my_vote: 1 }] : items };
          });
          if (seq === budgetSeq.current) setVoteBudget(budget);
          setComparison(null);
          return true;
        } catch {
          reload();
          return false;
        }
      }} />}
    </FeedContext.Provider>
  );
}
