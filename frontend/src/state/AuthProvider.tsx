import { Auth0Provider, useAuth0, type AppState } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { saveDisplayName, setAccessTokenGetter, USE_MOCK } from "../api/client";
import { AuthContext, publicName, type Auth } from "./auth";

const DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN;
const CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID;
const AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;

/** Mock mode: a sample sign-in, no account and no tokens. */
function MockAuth({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const value = useMemo<Auth>(
    () => ({
      ready: true,
      signedIn,
      name: signedIn ? "You" : null,
      picture: null,
      login: () => setSignedIn(true),
      logout: () => setSignedIn(false),
      error: null,
    }),
    [signedIn],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Real mode without the VITE_AUTH0_* settings: browsing works, sign-in explains what's missing. */
function MissingConfig({ children }: { children: ReactNode }) {
  const error = "Sign-in isn't set up: add VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID and VITE_AUTH0_AUDIENCE to frontend/.env.";
  const value = useMemo<Auth>(
    () => ({ ready: true, signedIn: false, name: null, picture: null, login: () => window.alert(error), logout: () => {}, error }),
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

  // Keep the API's display name in step with the Auth0 profile, once per sign-in or name change.
  const displayName = isAuthenticated ? publicName(user) : null;
  useEffect(() => {
    if (displayName) saveDisplayName(displayName).catch(() => {}); // comments fall back to "Neighbour"
  }, [displayName]);

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
      name: user?.name ?? user?.nickname ?? user?.email ?? null,
      picture: user?.picture ?? null,
      login,
      logout: signOut,
      error: error?.message ?? null,
    }),
    [isLoading, isAuthenticated, user, login, signOut, error],
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
