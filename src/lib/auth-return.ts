import { createPath, parsePath, type Location } from "react-router-dom";

/** Keep the originating route, including library filters and report options. */
export function loginFor(
  location: Pick<Location, "pathname" | "search" | "hash">,
) {
  const from = createPath(location);
  return location.pathname === "/login"
    ? from
    : "/login?next=" + encodeURIComponent(from);
}

export function afterLogin(next: string | null) {
  const path = next && parsePath(next).pathname;
  // Never use an external URL, an unknown route, or the login page as a redirect.
  return next &&
    path &&
    /^\/(?:workspace|verify|saved|settings|library|methodology|privacy|report\/[a-zA-Z0-9-]+)?$/.test(
      path,
    )
    ? next
    : "/workspace";
}
