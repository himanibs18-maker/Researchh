import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fail, must, validId } from "./http.js";
import {
  protectReport,
  readReport,
  seal,
  unseal,
  viewReport,
} from "./account-vault.js";
import { parseSubmission } from "./submission.js";
import { runWorker, checkReference } from "./jobs.js";
import { waitUntil } from "@vercel/functions";
import { enrichPublications } from "./publications.js";

const TABLE = "research_guest_records";
const digest = (value) => createHash("sha256").update(value).digest();
function uuidFrom(value) {
  const bytes = Buffer.from(value.subarray(0, 16));
  bytes[6] = (bytes[6] & 15) | 128;
  bytes[8] = (bytes[8] & 63) | 128;
  const s = bytes.toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
const idOf = (value) => validId(String(value || "").replace(/^g-/, ""));

// A browser-held 256-bit capability, never a shared guest account or public ID.
// Guest keys are never sent as URLs, saved in the database, or used for account APIs.
export function guestSession(req) {
  const token = req.headers.authorization?.match(/^Guest ([a-f0-9]{64})$/)?.[1];
  if (!token)
    throw fail(401, "Open a guest workspace in this browser to continue.");
  const owner = digest(token).toString("hex"),
    uid = uuidFrom(digest("guest-owner:" + token)),
    key = digest("guest-vault:" + token);
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { "x-research-guest": token } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const owned = () =>
    db.from(TABLE).select("*").eq("user_id", uid).eq("owner_hash", owner);
  const current = async (id, kind = "review") => {
    const row = must(
      await owned().eq("id", idOf(id)).eq("kind", kind).maybeSingle(),
    );
    if (!row)
      throw fail(404, "This item is not in this browser’s guest workspace.");
    return row;
  };
  const base = (id, kind, parent_id = null) => ({
    id,
    kind,
    parent_id,
    user_id: uid,
    owner_hash: owner,
  });
  const context = (kind, id) => `research-guest:${kind}:${uid}:${id}`;
  const worker = (id) =>
    waitUntil(
      runWorker(db, id, uid, key, TABLE).catch((e) =>
        console.error("Guest review checkpoint:", e.name),
      ),
    );
  async function reports(req, res) {
    if (req.method === "GET" && !req.query.id) {
      const rows = must(
        await owned()
          .eq("kind", "review")
          .order("created_at", { ascending: false })
          .limit(12),
      );
      return res.status(200).json(
        rows.map((row) => {
          const r = readReport(row, key);
          return {
            id: "g-" + r.id,
            format: r.format,
            status: r.status,
            title: r.title,
            file_name: r.file_name,
            created_at: r.created_at,
            claims: r.claims.map((c) => ({ status: c.status, id: c.id })),
            task_count: r.task_count,
            processed: r.processed,
            is_guest: true,
          };
        }),
      );
    }
    if (req.method === "GET") {
      const row = await current(req.query.id),
        r = readReport(row, key);
      if (req.query.download === "1") {
        const file = must(
          await owned().eq("parent_id", r.id).eq("kind", "original").single(),
        );
        return res
          .status(200)
          .json(unseal(file.extracted_text, key, context("original", file.id)));
      }
      const out = viewReport(r);
      out.id = "g-" + r.id;
      out.is_guest = true;
      out.sources = await enrichPublications(out.sources, db);
      return res.status(200).json(out);
    }
    if (req.method === "DELETE") {
      const row = await current(req.body?.id);
      must(
        await db
          .from(TABLE)
          .delete()
          .eq("owner_hash", owner)
          .eq("parent_id", row.id),
      );
      must(
        await db.from(TABLE).delete().eq("owner_hash", owner).eq("id", row.id),
      );
      return res.status(200).json({ ok: true });
    }
    const count = await db
      .from(TABLE)
      .select("id", { head: true, count: "exact" })
      .eq("owner_hash", owner)
      .eq("kind", "review");
    if (count.error) throw count.error;
    if (count.count >= 10)
      throw fail(
        429,
        "Your guest workspace contains 10 reviews. Delete one or sign in to your account workspace.",
      );
    const { bytes, name, format, text, detected } = await parseSubmission(
      req.body,
      true,
    );
    const id = randomUUID(),
      fid = randomUUID(),
      now = new Date().toISOString();
    const r = {
      id,
      user_id: uid,
      title: name.replace(/\.(pdf|docx)$/i, "").replace(/[_-]+/g, " "),
      file_name: name,
      format: format.toUpperCase(),
      size_bytes: bytes.length,
      word_count: text.split(/\s+/).length,
      extracted_text: text,
      ...detected,
      sources: [],
      checks: [],
      processed: 0,
      task_count: detected.queue.length,
      status: detected.queue.length ? "queued" : "complete",
      created_at: now,
      updated_at: now,
      is_guest: true,
      is_sample: false,
      review_method: "Source retrieval",
    };
    const original = {
      name,
      mime:
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content: bytes.toString("base64"),
    };
    must(
      await db
        .from(TABLE)
        .insert([
          {
            ...base(id, "review"),
            status: r.status,
            extracted_text: protectReport(r, key),
          },
          {
            ...base(fid, "original", id),
            extracted_text: seal(original, key, context("original", fid)),
          },
        ])
        .select("id"),
    );
    if (r.task_count) worker(id);
    return res.status(201).json({ id: "g-" + id });
  }
  async function resume(req, res) {
    const r = await current(req.body?.id);
    if (req.body?.figure_id)
      return res
        .status(200)
        .json(await checkReference(db, r.id, uid, key, req.body, TABLE));
    if (
      r.status !== "complete" &&
      (!r.lease_until || Date.parse(r.lease_until) < Date.now())
    )
      worker(r.id);
    return res.status(202).json({ status: r.status });
  }
  async function bookmarks(req, res, sample) {
    if (req.method === "GET") {
      const rows = must(
        await owned()
          .eq("kind", "bookmark")
          .order("created_at", { ascending: false }),
      );
      return res
        .status(200)
        .json(
          rows.map((x) =>
            unseal(x.extracted_text, key, context("bookmark", x.id)),
          ),
        );
    }
    if (req.method === "DELETE") {
      const row = await current(req.body?.id, "bookmark");
      must(
        await db.from(TABLE).delete().eq("owner_hash", owner).eq("id", row.id),
      );
      return res.status(200).json({ ok: true });
    }
    const requested = idOf(req.body?.report_id);
    const r =
      requested === "a258d5a1-0b16-4b22-8dfd-560c40000101"
        ? await sample()
        : readReport(await current(requested), key);
    const c = r.claims.find((x) => x.id === req.body?.claim_id);
    if (!c) throw fail(400, "Select a claim from your report.");
    const id = uuidFrom(digest(`${uid}:${r.id}:${c.id}`)),
      b = {
        id: "g-" + id,
        report_id: r.is_sample ? r.id : "g-" + r.id,
        claim_id: c.id,
        claim_text: c.text,
        status: c.status,
        report_title: r.title,
      };
    must(
      await db
        .from(TABLE)
        .upsert({
          ...base(id, "bookmark", r.id),
          extracted_text: seal(b, key, context("bookmark", id)),
        })
        .select("id"),
    );
    return res.status(201).json({ id: b.id });
  }
  return { reports, process: resume, bookmarks };
}
