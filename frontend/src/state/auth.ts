import type { User } from "@auth0/auth0-react";
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
  /** Renames you everywhere (comments, hosted events). Throws if the name is invalid or the save fails. */
  rename: (name: string) => Promise<void>;
  error: string | null; // set when Auth0 isn't configured or the last sign-in failed
}

export const AuthContext = createContext<Auth | null>(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside <AuthProvider>");
  return auth;
}

/** Tidies a name the way the API does before saving it: NFC, single spaces, trimmed. */
export function tidyName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** The API's rule for a display name (after tidyName): 1–60 characters, no control characters, < or >. */
export function isValidName(name: string): boolean {
  // eslint-disable-next-line no-control-regex
  return name.length > 0 && name.length <= 60 && !/[\u0000-\u001f\u007f<>]/.test(name);
}

/**
 * The public name for comments and hosted events: "Roshan R." from the Google/Auth0 profile.
 * Never an email address; null if the profile only has one (the API then shows "Neighbour").
 */
export function publicName(user: User | undefined): string | null {
  const clean = (s: unknown) => (typeof s === "string" ? tidyName(s.replace(/[<>]/g, "")) : "");
  const given = clean(user?.given_name), family = clean(user?.family_name);
  if (given && !given.includes("@")) return `${given}${family ? ` ${family.charAt(0).toUpperCase()}.` : ""}`.slice(0, 60);
  for (const candidate of [clean(user?.name), clean(user?.nickname)])
    if (candidate && !candidate.includes("@")) return candidate.slice(0, 60);
  return null;
}
