import "../server/runtime.js";
import supabase from "./db-client.js";
import { checkedPapers } from "../server/curation-integrity.js";
import { cors, allowed, must, fail, sendError } from "../server/http.js";
import { lookup, dois } from "../server/scholar.js";
import { enrichPublications } from "../server/publications.js";
export const config = { maxDuration: 20 };
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    allowed(req, ["GET"]);
    if (req.query.directory === "1") {
      const rows = must(
        await supabase
          .from("research_source_directory")
          .select("name,url,purpose,coverage,mode,sort_order")
          .order("sort_order"),
      );
      const hosts = new Set([
        "search.crossref.org",
        "openalex.org",
        "www.semanticscholar.org",
        "pubmed.ncbi.nlm.nih.gov",
        "pmc.ncbi.nlm.nih.gov",
        "europepmc.org",
        "doaj.org",
        "arxiv.org",
        "core.ac.uk",
        "www.doabooks.org",
        "commons.datacite.org",
        "zenodo.org",
        "explore.openaire.eu",
        "opencitations.net",
      ]);
      res.setHeader("Cache-Control", "public, s-maxage=600");
      return res.status(200).json(
        rows.filter((r) => {
          try {
            const url = new URL(r.url);
            return (
              url.protocol === "https:" &&
              hosts.has(url.hostname) &&
              !url.username &&
              !url.password
            );
          } catch {
            return false;
          }
        }),
      );
    }
    const q = String(req.query.q || "").trim(),
      provider = String(req.query.provider || "All");
    if (!["All", "Crossref", "OpenAlex", "Semantic Scholar"].includes(provider))
      throw fail(400, "Unknown scholarly database.");
    if (q.length > 300) throw fail(400, "Keep searches under 300 characters.");
    if (!q) {
      const sources = await enrichPublications(
        checkedPapers(
          must(
            await supabase
              .from("research_papers")
              .select("*")
              .order("year", { ascending: false }),
          ),
        ),
        supabase,
      );
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=300, stale-while-revalidate=600",
      );
      return res.status(200).json({
        sources:
          provider === "All"
            ? sources
            : sources.filter((x) => x.providers.includes(provider)),
        checks: [],
      });
    }
    if (q.length < 3)
      throw fail(400, "Enter at least three characters or a DOI.");
    const doi = dois(q)[0];
    const data = await lookup(doi || q, !!doi, provider);
    data.sources = await enrichPublications(data.sources, supabase);
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=180, stale-while-revalidate=300",
    );
    return res.status(200).json(data);
  } catch (e) {
    sendError(res, e);
  }
}
