import "../server/runtime.js";
import supabase from "./db-client.js";
import { cors, allowed, identity, fail, sendError } from "../server/http.js";
import {
  updateAccount,
  privateUploadsEnabled,
} from "../server/account-vault.js";
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    allowed(req, ["GET", "PUT"]);
    const { user } = await identity(req, supabase);
    const p = {
      display_name: user.user_metadata?.full_name || "",
      institution: "",
      theme: "light",
      report_format: "PDF",
      ...(user.user_metadata?.research_profile || {}),
    };
    if (req.method === "GET")
      return res.status(200).json({
        ...p,
        email: user.email,
        ai_available: !!process.env.GEMINI_API_KEY,
        private_uploads_enabled: privateUploadsEnabled(),
      });
    const b = req.body || {};
    for (const k of ["display_name", "institution"])
      if (b[k] !== undefined) {
        if (
          typeof b[k] !== "string" ||
          b[k].length > (k === "display_name" ? 70 : 120)
        )
          throw fail(400, "This profile field is too long.");
        p[k] = b[k].trim();
      }
    if (b.theme !== undefined) {
      if (!["light", "dark", "system"].includes(b.theme))
        throw fail(400, "Invalid appearance setting.");
      p.theme = b.theme;
    }
    if (b.report_format !== undefined) {
      if (!["PDF", "DOCX", "Excel", "CSV"].includes(b.report_format))
        throw fail(400, "Invalid export preference.");
      p.report_format = b.report_format;
    }
    await updateAccount(req, { research_profile: p });
    return res.status(200).json(p);
  } catch (e) {
    sendError(res, e);
  }
}
