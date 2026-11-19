import "../server/runtime.js";
import supabase from "./db-client.js";
import { checkedSample } from "../server/curation-integrity.js";
import {
  cors,
  allowed,
  identity,
  validId,
  must,
  fail,
  sendError,
} from "../server/http.js";
import {
  accountKey,
  readReport,
  seal,
  unseal,
} from "../server/account-vault.js";
import { randomUUID } from "node:crypto";
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    allowed(req, ["GET", "POST", "DELETE"]);
    const { user, scoped } = await identity(req, supabase);
    if (req.method === "GET") {
      const rows = must(
        await scoped
          .from("research_bookmarks")
          .select("id,claim_text")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      );
      if (!rows.length) return res.status(200).json([]);
      const key = await accountKey(req, user);
      return res
        .status(200)
        .json(
          rows.map((r) =>
            unseal(r.claim_text, key, `bookmark:${user.id}:${r.id}`),
          ),
        );
    }
    if (req.method === "DELETE") {
      must(
        await scoped
          .from("research_bookmarks")
          .delete()
          .eq("id", validId(req.body?.id))
          .eq("user_id", user.id),
      );
      return res.status(200).json({ ok: true });
    }
    const id = validId(req.body?.report_id);
    let report;
    if (id === "a258d5a1-0b16-4b22-8dfd-560c40000101") {
      report = must(
        await scoped
          .from("research_reports")
          .select("id,title,file_name,claims,checks,citations")
          .eq("id", id)
          .is("user_id", null)
          .eq("is_sample", true)
          .single(),
      );
      checkedSample(report);
    } else {
      const row = must(
        await scoped
          .from("research_reports")
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if (!row) throw fail(404, "Review not found.");
      report = readReport(row, await accountKey(req, user));
    }
    const claim = report.claims.find((c) => c.id === req.body?.claim_id);
    if (!claim) throw fail(400, "Choose a claim from this review.");
    const old = must(
      await scoped
        .from("research_bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("report_id", id)
        .eq("claim_id", claim.id)
        .limit(1)
        .maybeSingle(),
    );
    if (old) return res.status(200).json(old);
    const bid = randomUUID(),
      data = {
        id: bid,
        report_id: id,
        claim_id: claim.id,
        claim_text: claim.text,
        status: claim.status,
        report_title: report.title,
      };
    const key = await accountKey(req, user, true);
    const row = must(
      await scoped
        .from("research_bookmarks")
        .insert({
          id: bid,
          user_id: user.id,
          report_id: id,
          claim_id: claim.id,
          claim_text: seal(data, key, `bookmark:${user.id}:${bid}`),
          status: "Encrypted",
          report_title: "Encrypted",
        })
        .select("id")
        .single(),
    );
    res.status(201).json(row);
  } catch (e) {
    sendError(res, e);
  }
}
