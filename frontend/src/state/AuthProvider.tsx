import { Auth0Provider, useAuth0, type AppState } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, getDisplayName, saveDisplayName, setAccessTokenGetter, USE_MOCK } from "../api/client";
import { AuthContext, isValidName, publicName, tidyName, type Auth } from "./auth";

const DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN;
const CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID;
const AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;

/** Mock mode: a sample sign-in, no account and no tokens. */
function MockAuth({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState("You");
  const value = useMemo<Auth>(
    () => ({
      ready: true,
      signedIn,
      name: signedIn ? name : null,
      picture: null,
      login: () => setSignedIn(true),
      logout: () => setSignedIn(false),
      // Same tidying and rule as the API, so mock mode shows the same errors.
      rename: async (next: string) => {
        const clean = tidyName(next);
        if (!isValidName(clean)) throw new ApiError(400);
        setName(clean);
      },
      error: null,
    }),
    [signedIn, name],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Real mode without the VITE_AUTH0_* settings: browsing works, sign-in explains what's missing. */
function MissingConfig({ children }: { children: ReactNode }) {
  const error = "Sign-in isn't set up: add VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID and VITE_AUTH0_AUDIENCE to frontend/.env.";
  const value = useMemo<Auth>(
    () => ({ ready: true, signedIn: false, name: null, picture: null, login: () => window.alert(error), logout: () => {}, rename: async () => {}, error }),
    [error],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Turns Auth0's state into our Auth and hands the API client a way to get access tokens. */
function Auth0Bridge({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user, error, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();

  // Set during render, not in an effect: FeedProvider's first fetch runs in an effect below this
  // component, and child effects run before parent ones.
  setAccessTokenGetter(isAuthenticated ? () => getAccessTokenSilently() : null);

  // The name people see. A name you chose in Settings wins; the Auth0 profile only seeds it the first time.
  // The last saved name is kept per account in localStorage, so a reload doesn't flash the Auth0 name first.
  const [savedName, setSavedName] = useState<string | null>(null);
  const seedName = isAuthenticated ? publicName(user) : null;
  const cacheKey = isAuthenticated && user?.sub ? `bbb-display-name:${user.sub}` : null;
  const cachedName = useMemo(() => {
    try { return cacheKey ? localStorage.getItem(cacheKey) : null; } catch { return null; }
  }, [cacheKey]);
  const keep = useCallback((next: string) => {
    setSavedName(next);
    try { if (cacheKey) localStorage.setItem(cacheKey, next); } catch { /* shown for this page only */ }
  }, [cacheKey]);

  // Settled once the first-sign-in load (and seed save) is done. rename waits on it so the seed can't land after a rename.
  const loaded = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!isAuthenticated) { setSavedName(null); return; }
    let cancelled = false;
    loaded.current = getDisplayName()
      .then(async (existing) => {
        if (cancelled) return;
        if (existing) return keep(existing);
        if (seedName) { const saved = await saveDisplayName(seedName); if (!cancelled) keep(saved); }
      })
      .catch(() => {}); // comments fall back to "Neighbour"
    return () => { cancelled = true; };
  }, [isAuthenticated, seedName, keep]);

  const rename = useCallback(async (next: string) => {
    await loaded.current;
    keep(await saveDisplayName(next)); // the API tidies the name and sends back what it stored
  }, [keep]);

  const login = useCallback(() => {
    // Come back to the page they were on. What they tapped isn't replayed, since the page reloads.
    void loginWithRedirect({ appState: { returnTo: window.location.pathname + window.location.search } });
  }, [loginWithRedirect]);
  const signOut = useCallback(() => {
    setAccessTokenGetter(null);
    void logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout]);

  const value = useMemo<Auth>(
    () => ({
      ready: !isLoading,
      signedIn: isAuthenticated,
      // Never the raw Auth0 name: for email sign-ins that's the email address, which publicName leaves out.
      name: savedName ?? cachedName ?? seedName,
      picture: user?.picture ?? null,
      login,
      logout: signOut,
      rename,
      error: error?.message ?? null,
    }),
    [isLoading, isAuthenticated, user, savedName, cachedName, seedName, login, signOut, rename, error],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function RealAuth({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const onRedirectCallback = useCallback(
    (appState?: AppState) => navigate(appState?.returnTo ?? "/", { replace: true }),
    [navigate],
  );
  return (
    <Auth0Provider
      domain={DOMAIN!}
      clientId={CLIENT_ID!}
      authorizationParams={{ redirect_uri: window.location.origin, audience: AUDIENCE }}
      // Keeps you signed in across reloads. Browsers that block third-party cookies would otherwise
      // drop the session on every refresh. Refresh tokens are used if the API allows offline access.
      cacheLocation="localstorage"
      useRefreshTokens
      useRefreshTokensFallback
      onRedirectCallback={onRedirectCallback}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  if (USE_MOCK) return <MockAuth>{children}</MockAuth>;
  if (!DOMAIN || !CLIENT_ID || !AUDIENCE) return <MissingConfig>{children}</MissingConfig>;
  return <RealAuth>{children}</RealAuth>;
}
