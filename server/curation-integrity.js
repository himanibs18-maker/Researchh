import { createHash } from "node:crypto";
import { fail } from "./http.js";
// Public samples are checked against the metadata and excerpts actually reviewed.
// These are integrity pins, not a substitute for the database source records.
const expected = new Map([
  [
    "10.1152/physrev.00032.2012",
    "b34294161cb254815017ee34fdca2882b2f383a0796601d33e9ddf8f6b1cc4bf",
  ],
  [
    "10.1111/j.1467-9280.2008.02209.x",
    "b08e429def7384a506b0dce4b86bd1e154af60878d30fdb79261a8b68d586261",
  ],
]);
const stable = (v) =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, stable(v[k])]),
        )
      : v;
const digest = (v) =>
  createHash("sha256")
    .update(JSON.stringify(stable(v)))
    .digest("hex");
const pick = (v, fields) =>
  Object.fromEntries(fields.split(",").map((k) => [k, v[k]]));
export function checkedPapers(rows) {
  return rows
    .filter((p) => expected.has(p.doi))
    .map((p) => {
      const source = pick(
        p,
        "id,title,doi,authors,year,journal,abstract,url,providers",
      );
      if (expected.get(p.doi) !== digest(source))
        throw fail(
          503,
          "A source record has changed since its last review. The curated example is temporarily unavailable.",
        );
      return source;
    });
}
export function checkedSample(row) {
  if (
    digest(pick(row, "title,file_name,claims,checks,citations")) !==
    "0a241402af9c7dc5bf90ca3acab38675f5b1cd047c0397ace25cb7d77377f5b5"
  )
    throw fail(503, "The public sample awaits an integrity review.");
  return row;
}
export function checkedVisualAudit(row) {
  if (
    !row ||
    digest(row) !==
      "e182cc048e53907a41ff2efd7e13cbc1be187cab5000c620b0385301b6012c9c"
  )
    throw fail(503, "The curated visual audit awaits an integrity review.");
  return row.visual_audit;
}
