const clean = (v) =>
  String(v || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const DOI = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
export function dois(text) {
  return [
    ...new Set(
      (text.match(DOI) || []).map((x) =>
        x
          .replace(/[.,;]+$/, "")
          .replace(/\)$/, (s) =>
            (x.match(/\(/g) || []).length < (x.match(/\)/g) || []).length
              ? ""
              : s,
          )
          .toLowerCase(),
      ),
    ),
  ];
}
const normdoi = (x) =>
  clean(x)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .toLowerCase();
function inverted(inv) {
  if (!inv) return "";
  const words = [];
  for (const [word, positions] of Object.entries(inv))
    for (const p of positions) if (p < 15000) words[p] = word;
  return words.join(" ");
}
function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}
function make(d) {
  d.doi = normdoi(d.doi);
  d.id = d.doi || d.id;
  d.title = clean(d.title);
  d.publisher = clean(d.publisher);
  d.publisher_source = safeUrl(d.publisher_source);
  d.open_access_url = safeUrl(d.open_access_url);
  d.abstract = clean(d.abstract).slice(0, 18000);
  d.url = d.doi ? `https://doi.org/${d.doi}` : safeUrl(d.url);
  return d;
}
async function get(url, headers = {}) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(8500),
    headers: {
      Accept: "application/json",
      "User-Agent": "ResearchEvidence/1.0 (scientific citation verification)",
      ...headers,
    },
  });
  if (!r.ok)
    throw Object.assign(
      new Error(
        r.status === 429
          ? "Rate limited"
          : r.status === 404
            ? "No record found"
            : r.status === 401 || r.status === 403
              ? "Access unavailable"
              : `Provider returned ${r.status}`,
      ),
      { status: r.status },
    );
  return r.json();
}
const fields =
  "title,abstract,authors,year,venue,url,externalIds,openAccessPdf";
export async function lookup(query, isDoi = false, only = "All") {
  const q = encodeURIComponent(query.slice(0, 320)),
    n = isDoi ? 1 : 3;
  const providers = {
    Crossref: async () => {
      const j = await get(
        isDoi
          ? `https://api.crossref.org/works/${q}`
          : `https://api.crossref.org/works?query.bibliographic=${q}&rows=${n}&select=DOI,title,author,container-title,publisher,published,abstract,URL`,
      );
      return (isDoi ? [j.message] : j.message.items).map((x) =>
        make({
          id: x.DOI,
          doi: x.DOI,
          title: x.title?.[0],
          authors: (x.author || [])
            .slice(0, 8)
            .map((a) => [a.given, a.family].filter(Boolean).join(" "))
            .join(", "),
          year: x.published?.["date-parts"]?.[0]?.[0] || null,
          journal: x["container-title"]?.[0] || "",
          publisher: x.publisher,
          publisher_source: `https://api.crossref.org/works/${encodeURIComponent(x.DOI)}`,
          record_links: {
            Crossref: `https://api.crossref.org/works/${encodeURIComponent(x.DOI)}`,
          },
          abstract: x.abstract,
          url: x.URL,
          providers: ["Crossref"],
        }),
      );
    },
    OpenAlex: async () => {
      const root = "https://api.openalex.org/works";
      const j = await get(
        (isDoi
          ? `${root}/https://doi.org/${q}?`
          : `${root}?search=${q}&per_page=${n}&`) +
          (process.env.OPENALEX_API_KEY
            ? `api_key=${encodeURIComponent(process.env.OPENALEX_API_KEY)}`
            : ""),
      );
      return (isDoi ? [j] : j.results).map((x) =>
        make({
          id: x.id,
          doi: x.doi,
          title: x.display_name,
          authors: (x.authorships || [])
            .slice(0, 8)
            .map((a) => a.author.display_name)
            .join(", "),
          year: x.publication_year,
          journal: x.primary_location?.source?.display_name || "",
          record_links: { OpenAlex: safeUrl(x.id) },
          open_access_url:
            x.best_oa_location?.landing_page_url || x.open_access?.oa_url,
          abstract: inverted(x.abstract_inverted_index),
          url: x.id,
          providers: ["OpenAlex"],
        }),
      );
    },
    "Semantic Scholar": async () => {
      const j = await get(
        isDoi
          ? `https://api.semanticscholar.org/graph/v1/paper/DOI:${q}?fields=${fields}`
          : `https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=${n}&fields=${fields}`,
        process.env.SEMANTIC_SCHOLAR_API_KEY
          ? { "x-api-key": process.env.SEMANTIC_SCHOLAR_API_KEY }
          : {},
      );
      return (isDoi ? [j] : j.data).map((x) =>
        make({
          id: x.paperId,
          doi: x.externalIds?.DOI,
          title: x.title,
          authors: (x.authors || [])
            .slice(0, 8)
            .map((a) => a.name)
            .join(", "),
          year: x.year,
          journal: x.venue || "",
          record_links: { "Semantic Scholar": safeUrl(x.url) },
          open_access_url: x.openAccessPdf?.url,
          abstract: x.abstract,
          url: x.url,
          providers: ["Semantic Scholar"],
        }),
      );
    },
  };
  const results = await Promise.all(
    Object.entries(providers)
      .filter(([p]) => only === "All" || p === only)
      .map(async ([provider, fn]) => {
        try {
          const sources = (await fn()).filter(
            (x) => x.title && x.id && (!isDoi || x.doi === query.toLowerCase()),
          );
          return {
            sources,
            check: {
              provider,
              query,
              outcome: sources.length
                ? isDoi
                  ? "DOI matched"
                  : "Candidates retrieved"
                : "No match",
              source_ids: sources.map((x) => x.id),
              checked_at: new Date().toISOString(),
            },
          };
        } catch (e) {
          return {
            sources: [],
            check: {
              provider,
              query,
              outcome: e.status === 404 ? "No match" : "Provider unavailable",
              detail:
                e.name === "TimeoutError" ? "Request timed out" : e.message,
              source_ids: [],
              checked_at: new Date().toISOString(),
            },
          };
        }
      }),
  );
  return {
    sources: mergeSources(results.flatMap((r) => r.sources)),
    checks: results.map((r) => r.check),
  };
}
export function mergeSources(sources) {
  const m = new Map();
  for (const s of sources) {
    const old = m.get(s.id);
    if (!old) m.set(s.id, { ...s });
    else {
      old.providers = [...new Set([...old.providers, ...s.providers])];
      if (!old.publisher && s.publisher) {
        old.publisher = s.publisher;
        old.publisher_source = s.publisher_source;
      }
      if (!old.open_access_url && s.open_access_url)
        old.open_access_url = s.open_access_url;
      old.record_links = { ...old.record_links, ...s.record_links };
      if ((s.abstract || "").length > (old.abstract || "").length)
        old.abstract = s.abstract;
    }
  }
  return [...m.values()];
}
