// Backfill publisher and database links for legacy reviews. New retrievals already
// include these fields. Never substitute a journal or an indexing service for a publisher.
const cache = new Map();
const https = (v) => (typeof v === "string" && /^https:\/\//i.test(v) ? v : "");
async function details(doi) {
  const cached = cache.get(doi);
  if (cached && cached.until > Date.now()) return cached.data;
  const record_links = {
    Crossref: `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
  };
  let publisher = "",
    publisher_source = "";
  try {
    const r = await fetch(record_links.Crossref, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    if (r.ok) {
      const { message: m } = await r.json();
      if (
        m.DOI?.toLowerCase() === doi.toLowerCase() &&
        typeof m.publisher === "string"
      ) {
        publisher = m.publisher.trim();
        publisher_source = record_links.Crossref;
      }
    }
  } catch {
    /* Missing metadata is explicitly reported. */
  }
  const data = {
    publisher,
    publisher_source,
    record_links: publisher ? record_links : {},
  };
  if (cache.size > 512) cache.delete(cache.keys().next().value);
  cache.set(doi, { data, until: Date.now() + (publisher ? 86400000 : 60000) });
  return data;
}
export async function enrichPublications(sources, db) {
  const missing = sources.filter((s) => s.doi && !s.publisher);
  if (!missing.length) return sources;
  const collected = new Map(),
    end = Date.now() + 6500;
  const dois = [...new Set(missing.map((x) => x.doi))];
  if (db) {
    const { data } = await db
      .from("research_publication_details")
      .select("doi,publisher,publisher_source,record_links")
      .in("doi", dois);
    for (const item of data || []) {
      if (
        item.publisher_source !==
          `https://api.crossref.org/works/${item.doi}` ||
        !item.publisher?.trim()
      )
        continue;
      collected.set(item.doi, {
        publisher: item.publisher,
        publisher_source: item.publisher_source,
        record_links: Object.fromEntries(
          Object.entries(item.record_links || {}).filter(([, v]) => https(v)),
        ),
      });
    }
  }
  const pending = dois.filter((doi) => !collected.has(doi));
  await Promise.all(
    Array.from({ length: Math.min(6, pending.length) }, async () => {
      while (pending.length && Date.now() < end) {
        const doi = pending.shift();
        collected.set(doi, await details(doi));
      }
    }),
  );
  return sources.map((s) => {
    const p = collected.get(s.doi);
    return {
      ...s,
      publisher: s.publisher || p?.publisher || "",
      publisher_source: https(s.publisher_source) || p?.publisher_source || "",
      record_links: { ...p?.record_links, ...s.record_links },
    };
  });
}
