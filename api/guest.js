import "../server/runtime.js";
import supabase from "./db-client.js";
import { cors, allowed, fail, sendError } from "../server/http.js";
import { guestSession } from "../server/guest-session.js";
import { sampleReport } from "./reports.js";
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    const resource = String(req.query.resource || "");
    if (!["reports", "process", "bookmarks"].includes(resource))
      throw fail(404, "Unknown guest resource.");
    allowed(req, resource === "process" ? ["POST"] : ["GET", "POST", "DELETE"]);
    const guest = guestSession(req);
    return await guest[resource](req, res, () => sampleReport(supabase));
  } catch (error) {
    sendError(res, error);
  }
}
