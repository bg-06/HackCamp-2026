import { createContext, useContext } from "react";

// Who is signed in. Real Auth0 when VITE_USE_MOCK=false, otherwise a sample sign-in that needs no account.
export interface Auth {
  ready: boolean; // false while Auth0 is still checking for an existing session
  signedIn: boolean;
  name: string | null;
  picture: string | null;
  // Auth0 leaves the page and comes back to the same URL; mock sign-in happens straight away.
  login: () => void;
  logout: () => void;
  error: string | null; // set when Auth0 isn't configured or the last sign-in failed
}

export const AuthContext = createContext<Auth | null>(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside <AuthProvider>");
  return auth;
}
