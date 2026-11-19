import { randomUUID } from "node:crypto";
import { must, fail } from "./http.js";
import { validSource, verifyFigure } from "./figure-origin.js";
import { readReport, protectReport } from "./account-vault.js";
import { lookup, mergeSources } from "./scholar.js";
import { assess } from "./review.js";
export async function processBatch(
  db,
  id,
  uid,
  key,
  table = "research_reports",
) {
  const record = must(
    await db.from(table).select("*").eq("id", id).eq("user_id", uid).single(),
  );
  const row = readReport(record, key);
  if (row.status === "complete") return "complete";
  if (record.lease_until && new Date(record.lease_until).getTime() > Date.now())
    return "leased";
  const lease = randomUUID(),
    now = new Date();
  const acquired = must(
    await db
      .from(table)
      .update({
        lease_id: lease,
        lease_until: new Date(now.getTime() + 55000).toISOString(),
        status: "processing",
      })
      .eq("id", id)
      .eq("user_id", uid)
      .eq("processed", row.processed)
      .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
      .select("id"),
  );
  if (!acquired.length) return "leased";
  try {
    const next = row.queue[row.processed];
    const tasks =
      next?.type === "figure"
        ? [next]
        : row.queue
            .slice(row.processed, row.processed + 2)
            .filter((t) => t.type !== "figure");
    if (next?.type === "figure") {
      const f = row.figures?.find((f) => f.id === next.figure_id);
      if (f) f.provenance = await verifyFigure(f, next.value);
    }
    const all = await Promise.all(
      tasks
        .filter((t) => t.type !== "figure")
        .map(async (t) => ({
          t,
          ...(await lookup(t.value, t.type === "doi")),
        })),
    );
    for (const result of all) {
      row.sources = mergeSources([...row.sources, ...result.sources]);
      row.checks.push(
        ...result.checks.map((c) => ({
          ...c,
          claim_id: result.t.claim_id || null,
          kind: result.t.type,
        })),
      );
    }
    await Promise.all(
      all
        .filter((r) => r.t.claim_id)
        .map(async (r) => {
          const i = row.claims.findIndex((c) => c.id === r.t.claim_id);
          row.claims[i] = await assess(row.claims[i], row.sources);
        }),
    );
    row.processed += tasks.length;
    row.status = row.processed >= row.queue.length ? "complete" : "queued";
    row.updated_at = new Date().toISOString();
    row.review_method = process.env.GEMINI_API_KEY
      ? "Source retrieval + Gemini"
      : "Source retrieval + exact-text matching";
    must(
      await db
        .from(table)
        .update({
          extracted_text: protectReport(row, key),
          processed: row.processed,
          status: row.status,
          lease_id: null,
          lease_until: null,
          updated_at: row.updated_at,
        })
        .eq("id", id)
        .eq("user_id", uid)
        .eq("lease_id", lease)
        .select("id"),
    );
    return row.status;
  } catch (e) {
    await db
      .from(table)
      .update({ status: "queued", lease_id: null, lease_until: null })
      .eq("id", id)
      .eq("user_id", uid)
      .eq("lease_id", lease);
    throw e;
  }
}
export async function runWorker(db, id, uid, key, table = "research_reports") {
  const since = Date.now();
  do {
    const status = await processBatch(db, id, uid, key, table);
    if (status !== "queued") return;
    await new Promise((r) => setTimeout(r, 150));
  } while (Date.now() - since < 24000);
}

// Compare-and-swap prevents overlapping source checks from losing evidence.
export async function checkReference(
  db,
  id,
  uid,
  key,
  body,
  table = "research_reports",
) {
  if (!/^F\d{3}$/.test(body.figure_id || "") || !validSource(body.source))
    throw fail(
      400,
      "Provide a publication DOI or a supported HTTPS repository asset link.",
    );
  const record = must(
    await db
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("user_id", uid)
      .maybeSingle(),
  );
  if (!record) throw fail(404, "Review not found in this workspace.");
  const row = readReport(record, key),
    f = row.figures?.find((x) => x.id === body.figure_id);
  if (!f) throw fail(404, "This figure was not found in the manuscript.");
  if (row.status !== "complete")
    throw fail(409, "Wait for the manuscript verification to finish.");
  if ((f.previous_checks?.length || 0) >= 8)
    throw fail(
      429,
      "This figure has reached its saved reference-comparison limit.",
    );
  const result = await verifyFigure(f, body.source.trim());
  f.previous_checks = [...(f.previous_checks || []), f.provenance];
  f.provenance = result;
  row.updated_at = new Date().toISOString();
  const saved = must(
    await db
      .from(table)
      .update({
        extracted_text: protectReport(row, key),
        updated_at: row.updated_at,
      })
      .eq("id", id)
      .eq("user_id", uid)
      .eq("updated_at", record.updated_at)
      .select("id"),
  );
  if (!saved.length)
    throw fail(
      409,
      "The report changed during this check. Reopen it and try again.",
    );
  return { status: result.status };
}
