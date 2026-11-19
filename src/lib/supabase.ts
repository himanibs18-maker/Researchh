import { createClient } from "@supabase/supabase-js";

// Allow the public interface to be reviewed locally when deployment credentials
// are not available. Authenticated and database-backed actions still require
// the real Supabase settings supplied by the project owner.
const missingSupabaseConfig = !(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);
// Missing credentials disable authentication as well; the explicit flag keeps
// authentication live while using presentation-safe local verification data.
export const offlineDemo = missingSupabaseConfig;
export const offlineVerificationDemo =
  missingSupabaseConfig || import.meta.env.VITE_OFFLINE_DEMO === "true";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://offline.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "offline-demo-key";
const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
);
export default supabase;
function guestCapability() {
  const slot = "research-guest-v1";
  let key = localStorage.getItem(slot);
  if (!key || !/^[a-f0-9]{64}$/.test(key)) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    localStorage.setItem(slot, key);
  }
  return key;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const [resource, query = ""] = path.split("?"),
    params = new URLSearchParams(query);
  const item = body as { id?: string; report_id?: string } | undefined;
  const guest =
    ["reports", "process", "bookmarks"].includes(resource) &&
    params.get("sample") !== "1" &&
    (!data.session ||
      params.get("guest") === "1" ||
      [params.get("id"), item?.id, item?.report_id].some((id) =>
        id?.startsWith("g-"),
      ));
  if (guest) params.set("resource", resource);
  const res = await fetch(guest ? `/api/guest?${params}` : `/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(guest
        ? { Authorization: `Guest ${guestCapability()}` }
        : data.session
          ? { Authorization: `Bearer ${data.session.access_token}` }
          : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let dataOut;
  try {
    dataOut = await res.json();
  } catch {
    throw new Error(
      "The research service is temporarily unavailable. Please retry.",
    );
  }
  if (!res.ok)
    throw new Error(dataOut.error || "This request could not be completed.");
  return dataOut;
}
export function googleSignIn() {
  const client = import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirect = import.meta.env.VITE_GOOGLE_AUTH_PROXY;
  if (!client || !redirect)
    throw new Error("Google sign-in is unavailable. Use your email instead.");
  const state = btoa(
    JSON.stringify({
      origin: window.location.origin,
      appName: "Research",
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    }),
  );
  const p = window.open(
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(client)}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=openid%20email%20profile&prompt=select_account&state=${encodeURIComponent(state)}`,
    "research-google",
    /iPhone|iPad|Android/i.test(navigator.userAgent)
      ? ""
      : "width=500,height=640",
  );
  if (!p) throw new Error("Allow the sign-in popup, or continue with email.");
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Sign-in timed out. Please try again."));
    }, 180000);
    async function handler(e: MessageEvent) {
      if (e.source !== p || e.origin !== new URL(redirect).origin) return;
      if (!["google-auth-success", "google-auth-denied"].includes(e.data?.type))
        return;
      clearTimeout(timer);
      window.removeEventListener("message", handler);
      if (e.data.type === "google-auth-denied") {
        reject(new Error("Google sign-in was cancelled."));
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: e.data.access_token,
        refresh_token: e.data.refresh_token,
      });
      if (error) reject(error);
      else resolve();
    }
    window.addEventListener("message", handler);
  });
}
export async function handleGoogleRedirect() {
  if (!new URLSearchParams(location.hash.slice(1)).has("google_auth_popup"))
    return;
  const { data } = await supabase.auth.getSession();
  if (data.session) window.close();
}
void handleGoogleRedirect();
