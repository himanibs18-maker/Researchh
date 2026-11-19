import "../server/runtime.js";
import supabase from "./db-client.js";
import {
  cors,
  identity,
  validId,
  must,
  fail,
  sendError,
  allowed,
} from "../server/http.js";
import { accountKey } from "../server/account-vault.js";
import { work } from "../server/review.js";
import { checkReference } from "../server/jobs.js";
import { waitUntil } from "@vercel/functions";
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    allowed(req, ["POST"]);
    const { user, scoped } = await identity(req, supabase),
      id = validId(req.body?.id);
    if (req.body?.figure_id)
      return res
        .status(200)
        .json(
          await checkReference(
            scoped,
            id,
            user.id,
            await accountKey(req, user),
            req.body,
          ),
        );
    const r = must(
      await scoped
        .from("research_reports")
        .select("id,status,lease_until")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    if (!r) throw fail(404, "Review not found.");
    if (
      r.status !== "complete" &&
      (!r.lease_until || new Date(r.lease_until).getTime() < Date.now())
    ) {
      const key = await accountKey(req, user);
      waitUntil(
        work(scoped, id, user.id, key).catch((e) =>
          console.error("Review checkpoint:", e.name),
        ),
      );
    }
    res.status(202).json({ status: r.status });
  } catch (e) {
    sendError(res, e);
  }
}
