import "../server/runtime.js";
import supabase from "./db-client.js";
import {
  checkedPapers,
  checkedSample,
  checkedVisualAudit,
} from "../server/curation-integrity.js";
import {
  cors,
  identity,
  fail,
  must,
  sendError,
  allowed,
  validId,
} from "../server/http.js";
import {
  accountKey,
  encryptBytes,
  decryptBytes,
  readReport,
  protectReport,
  viewReport,
  privateUploadsEnabled,
} from "../server/account-vault.js";
import { randomUUID } from "node:crypto";
import { work } from "../server/review.js";
import { parseSubmission } from "../server/submission.js";
import { enrichPublications } from "../server/publications.js";
import { waitUntil } from "@vercel/functions";
export const config = { maxDuration: 60 };
const SAMPLE = "a258d5a1-0b16-4b22-8dfd-560c40000101";
const BUCKET = "research-vault";
const mime = (f) =>
  f === "PDF"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export async function sampleReport(db = supabase) {
  const r = must(
    await db
      .from("research_reports")
      .select("*")
      .eq("id", SAMPLE)
      .eq("is_sample", true)
      .is("user_id", null)
      .maybeSingle(),
  );
  if (!r) throw fail(404, "The sample review is unavailable.");
  r.sources = must(
    await db
      .from("research_papers")
      .select("*")
      .in(
        "id",
        r.sources.map((s) => s.id),
      ),
  );
  r.sources = checkedPapers(r.sources);
  if (r.sources.length !== 2)
    throw fail(503, "The complete curated evidence set is unavailable.");
  const out = viewReport(checkedSample(r));
  const audit = must(
    await db
      .from("research_sample_figure_audits")
      .select("report_id,manuscript_sha256,visual_audit")
      .eq("report_id", r.id)
      .single(),
  );
  Object.assign(out, checkedVisualAudit(audit));
  out.sources = await enrichPublications(out.sources, db);
  return out;
}
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    allowed(req, ["GET", "POST", "DELETE"]);
    if (req.method === "GET" && req.query.sample === "1")
      return res.status(200).json(await sampleReport());
    const { user, scoped } = await identity(req, supabase);
    if (req.method === "GET") {
      if (req.query.id) {
        const id = validId(req.query.id);
        if (id === SAMPLE) return res.status(200).json(await sampleReport());
        const row = must(
          await scoped
            .from("research_reports")
            .select("*")
            .eq("id", id)
            .eq("user_id", user.id)
            .maybeSingle(),
        );
        if (!row) throw fail(404, "Review not found in your workspace.");
        const key = await accountKey(req, user),
          r = readReport(row, key);
        if (req.query.download === "1") {
          const blob = must(
            await scoped.storage.from(BUCKET).download(r.storage_path),
          );
          const data = decryptBytes(
            Buffer.from(await blob.arrayBuffer()),
            key,
            `file:${user.id}:${r.id}`,
          );
          return res.status(200).json({
            name: r.file_name,
            mime: mime(r.format),
            content: data.toString("base64"),
          });
        }
        const out = viewReport(r);
        out.sources = await enrichPublications(out.sources, scoped);
        return res.status(200).json(out);
      }
      const all = [];
      for (let offset = 0; ; offset += 50) {
        const rows = must(
          await scoped
            .from("research_reports")
            .select("id,user_id,extracted_text,created_at,updated_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .range(offset, offset + 49),
        );
        if (rows.length) {
          const key = await accountKey(req, user);
          for (const row of rows) {
            const r = readReport(row, key);
            all.push({
              id: r.id,
              title: r.title,
              file_name: r.file_name,
              format: r.format,
              word_count: r.word_count,
              status: r.status,
              claims: r.claims.map((c) => ({ id: c.id, status: c.status })),
              created_at: r.created_at,
              processed: r.processed,
              task_count: r.task_count,
            });
          }
        }
        if (rows.length < 50) break;
      }
      return res.status(200).json(all);
    }
    if (req.method === "DELETE") {
      const id = validId(req.body?.id),
        row = must(
          await scoped
            .from("research_reports")
            .select("*")
            .eq("id", id)
            .eq("user_id", user.id)
            .maybeSingle(),
        );
      if (!row) throw fail(404, "Review not found.");
      const r = readReport(row, await accountKey(req, user));
      if (r.storage_path)
        must(await scoped.storage.from(BUCKET).remove([r.storage_path]));
      must(
        await scoped
          .from("research_reports")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id),
      );
      return res.status(200).json({ ok: true });
    }
    const b = req.body || {};
    const count = await scoped
      .from("research_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString());
    if (count.error) throw count.error;
    if (count.count >= 20)
      throw fail(
        429,
        "Daily limit reached. Each account can create 20 reviews per day.",
      );
    const {
      bytes: buffer,
      name,
      format,
      text: extracted,
      detected: parsed,
    } = await parseSubmission(b, !privateUploadsEnabled());
    const id = randomUUID(),
      path = `${user.id}/${id}.enc`,
      key = await accountKey(req, user, true),
      at = new Date().toISOString();
    const r = {
      id,
      user_id: user.id,
      title: name.replace(/\.(pdf|docx)$/i, "").replace(/[_-]+/g, " "),
      file_name: name,
      format: format.toUpperCase(),
      storage_path: path,
      size_bytes: buffer.length,
      word_count: extracted.split(/\s+/).length,
      extracted_text: extracted,
      ...parsed,
      claims: parsed.claims,
      sources: [],
      checks: [],
      task_count: parsed.queue.length,
      processed: 0,
      status: parsed.queue.length ? "queued" : "complete",
      review_method: "Source retrieval",
      created_at: at,
      updated_at: at,
      is_sample: false,
    };
    must(
      await scoped.storage
        .from(BUCKET)
        .upload(path, encryptBytes(buffer, key, `file:${user.id}:${id}`), {
          contentType: "application/octet-stream",
          upsert: false,
        }),
    );
    const result = await scoped
      .from("research_reports")
      .insert({
        id,
        user_id: user.id,
        title: "Encrypted review",
        file_name: "Encrypted document",
        format: "Encrypted",
        extracted_text: protectReport(r, key),
        status: r.status,
        processed: 0,
        task_count: r.task_count,
      })
      .select("id")
      .single();
    if (result.error) {
      await scoped.storage.from(BUCKET).remove([path]);
      throw result.error;
    }
    if (r.queue.length)
      waitUntil(
        work(scoped, id, user.id, key).catch((e) =>
          console.error("Review checkpoint:", e.name),
        ),
      );
    return res.status(201).json(result.data);
  } catch (e) {
    sendError(res, e);
  }
}
