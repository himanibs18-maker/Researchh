import { hash, rasterInfo, xml, elements, plain } from "./figures.js";
import { dois } from "./scholar.js";

const hosts = new Set([
  "api.crossref.org",
  "www.ebi.ac.uk",
  "europepmc.org",
  "pmc.ncbi.nlm.nih.gov",
  "cdn.ncbi.nlm.nih.gov",
  "commons.wikimedia.org",
  "upload.wikimedia.org",
  "journals.plos.org",
  "zenodo.org",
  "matplotlib.org",
]);
const clean = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
// Only specific public scholarly repositories are contacted. No URL-controlled proxy.
async function bounded(url, limit = 4_000_000, signal, hop = 0) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    !hosts.has(u.hostname) ||
    hop > 2
  )
    throw Error("Unsupported repository location");
  const r = await fetch(u, {
    signal: AbortSignal.any([AbortSignal.timeout(5000), signal]),
    redirect: "manual",
    headers: { "User-Agent": "ResearchEvidence/1.0 (figure provenance check)" },
  });
  if (r.status >= 300 && r.status < 400) {
    const dest = r.headers.get("location");
    if (!dest) throw Error("Unresolved redirect");
    return bounded(new URL(dest, u).href, limit, signal, hop + 1);
  }
  if (!r.ok) throw Error(`Repository returned ${r.status}`);
  if (Number(r.headers.get("content-length")) > limit) {
    await r.body?.cancel();
    throw Error("Source exceeds comparison size limit");
  }
  const chunks = [];
  let n = 0;
  for await (const data of r.body) {
    n += data.length;
    if (n > limit) throw Error("Source exceeds comparison size limit");
    chunks.push(data);
  }
  return {
    bytes: Buffer.concat(chunks),
    url: u.href,
    type: r.headers.get("content-type") || "",
  };
}
const json = async (url, signal) =>
  JSON.parse((await bounded(url, 650000, signal)).bytes.toString());
export function validSource(input) {
  const value = String(input || "").trim();
  if (!value || value.length > 480) return false;
  if (/^10\.\d{4,9}\/[-._;()/:a-z\d]+$/i.test(value)) return true;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port)
      return false;
    return (
      (["doi.org", "dx.doi.org"].includes(u.hostname) &&
        dois(decodeURIComponent(u.pathname)).length > 0) ||
      (u.hostname === "commons.wikimedia.org" &&
        /^\/wiki\/File:/i.test(u.pathname)) ||
      (u.hostname === "upload.wikimedia.org" &&
        u.pathname.startsWith("/wikipedia/commons/")) ||
      (u.hostname === "zenodo.org" &&
        /^\/records?\/\d+\/files\//.test(u.pathname)) ||
      (u.hostname === "matplotlib.org" &&
        /^\/(?:stable|[\d.]+)\/_images\/[a-zA-Z\d_-]+\.(?:png|jpe?g)$/.test(
          u.pathname,
        )) ||
      (u.hostname === "cdn.ncbi.nlm.nih.gov" &&
        u.pathname.startsWith("/pmc/")) ||
      (u.hostname === "journals.plos.org" &&
        /^\/[a-z]+\/article\/figure\/image$/.test(u.pathname))
    );
  } catch {
    return false;
  }
}
export function sameChartData(chart, bytes) {
  if (bytes.length > 900000 || !chart?.series?.length) return false;
  const s = bytes.toString("utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if (c === "\n" && !quoted) {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (quoted || rows.length < 2) return false;
  const names = rows.shift();
  if (
    names.length !== chart.series.length + 1 ||
    chart.series.some(
      (v, i) =>
        v.name !== names[i + 1] ||
        v.values.length !== rows.length ||
        v.categories.length !== rows.length,
    )
  )
    return false;
  return rows.every(
    (r, i) =>
      r.length === names.length &&
      chart.series.every(
        (v, j) =>
          r[0] === v.categories[i] &&
          r[j + 1].trim() !== "" &&
          Number.isFinite(v.values[i]) &&
          Number(r[j + 1]) === v.values[i],
      ),
  );
}
export async function verifyFigure(figure, source) {
  const signal = AbortSignal.timeout(16300),
    checks = [];
  const result = {
    status: "Origin unresolved",
    explanation: "No independent visual match was established.",
    source_input: source,
    checks,
    checked_at: new Date().toISOString(),
    source_url: "",
    source_title: "",
    credit: "",
    license: "",
    reference_url: "",
    reference_hash: "",
  };
  const log = (service, outcome, url = "") =>
    checks.push({ service, outcome, url });
  const finish = (status, explanation) => ({ ...result, status, explanation });
  async function compare(url, label, allowCsv = false) {
    try {
      const {
        bytes,
        url: actual,
        type,
      } = await bounded(url, 5_000_000, signal);
      if (type.includes("text/html"))
        throw Error("Repository returned a page, not a comparison file");
      const fileHash = hash(bytes);
      if (figure.chart && allowCsv) {
        const ok = sameChartData(figure.chart, bytes);
        log(
          label,
          ok
            ? "All cached series names, category labels, and numeric values match the reference CSV."
            : "CSV table does not exactly match the complete cached chart table.",
          actual,
        );
        if (ok) {
          result.reference_url = actual;
          result.reference_hash = fileHash;
          return "Chart data match";
        }
        return "different";
      }
      if (figure.file_sha256 && fileHash === figure.file_sha256) {
        result.reference_url = actual;
        result.reference_hash = fileHash;
        log(label, "SHA-256 matches the original embedded file bytes.", actual);
        return "Exact file match";
      }
      if (figure.kind !== "Image" || !figure.pixel_sha256) {
        log(
          label,
          "Reference located; the manuscript item is not an independently comparable raster image.",
          actual,
        );
        return "located";
      }
      const img = await rasterInfo(bytes, false);
      const ok = img.pixel_sha256 === figure.pixel_sha256;
      log(
        label,
        ok
          ? "Dimensions and decoded RGBA pixel fingerprint match."
          : "Decoded raster pixels are not identical at their original dimensions.",
        actual,
      );
      if (ok) {
        result.reference_url = actual;
        result.reference_hash = img.pixel_sha256;
        return "Exact pixel match";
      }
      return "different";
    } catch (e) {
      log(
        label,
        e.name === "TimeoutError" ? "Repository request timed out." : e.message,
        url,
      );
      return "unavailable";
    }
  }
  if (!validSource(source)) {
    log(
      "Attribution",
      "No supported DOI, Commons file, or repository asset was supplied.",
    );
    return finish(
      "Origin unresolved",
      "A caption or unsupported link alone cannot establish the figure’s origin. Supply a DOI or supported repository link to compare an independent source.",
    );
  }
  try {
    const isUrl = source.startsWith("https://"),
      u = isUrl ? new URL(source) : null;
    const doi =
      !u || ["doi.org", "dx.doi.org"].includes(u.hostname)
        ? dois(decodeURIComponent(source))[0]
        : null;
    let outcome = "unavailable";
    if (doi) {
      const cr = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
      let resolved = false;
      try {
        const m = (await json(cr, signal)).message;
        if (m.DOI?.toLowerCase() === doi) {
          resolved = true;
          result.source_url = "https://doi.org/" + doi;
          result.source_title = clean(m.title?.[0]);
          result.credit = (m.author || [])
            .slice(0, 6)
            .map((a) => [a.given, a.family].filter(Boolean).join(" "))
            .join(", ");
          log(
            "Crossref",
            "Publication DOI resolved. Publication authorship does not establish figure authorship.",
            cr,
          );
        }
      } catch {
        log("Crossref", "Publication lookup unavailable.", cr);
      }
      const query = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent('DOI:"' + doi + '"')}&format=json&pageSize=3`;
      let article;
      try {
        article = (await json(query, signal)).resultList?.result?.find(
          (x) => x.doi?.toLowerCase() === doi && /^PMC\d+$/.test(x.pmcid),
        );
      } catch {
        log("Europe PMC", "Open-article lookup unavailable.", query);
      }
      if (!article) {
        log(
          "Europe PMC",
          "No accessible full-text figure set was resolved for this DOI.",
          query,
        );
        return finish(
          resolved ? "Attribution only" : "Origin unresolved",
          "A publication record is not an image match. No open reference artwork was available for direct comparison.",
        );
      }
      result.source_url = "https://europepmc.org/articles/" + article.pmcid;
      result.source_title = clean(article.title);
      const articleXml = `https://www.ebi.ac.uk/europepmc/webservices/rest/${article.pmcid}/fullTextXML`;
      const root = xml(
        (await bounded(articleXml, 4_000_000, signal)).bytes.toString(),
      );
      const figs = elements(root, "fig");
      log(
        "Europe PMC",
        `${figs.length} figure entries present in the retrieved full-text record.`,
        articleXml,
      );
      const words = new Set(
        (figure.caption || "").toLowerCase().match(/[a-z]{4,}/g) || [],
      );
      const rank = (f) =>
        [
          ...new Set(
            plain(elements(f, "caption")[0])
              .toLowerCase()
              .match(/[a-z]{4,}/g) || [],
          ),
        ].filter((w) => words.has(w)).length;
      const candidates = figs.sort((a, b) => rank(b) - rank(a)).slice(0, 5);
      let different = false;
      for (const f of candidates) {
        if (signal.aborted) break;
        const label = plain(elements(f, "label")[0]) || "Article figure",
          g = elements(f, "graphic")[0],
          asset = g?.getAttribute("xlink:href") || g?.getAttribute("href");
        const obj = elements(f, "object-id").find(
            (x) => x.getAttribute("pub-id-type") === "doi",
          ),
          fd = plain(obj);
        const plos = fd.match(
          /^10\.1371\/journal\.(pone|pcbi|pgen|pmed|pbio|ppat|pntd)\.\d+\.g\d+$/i,
        );
        const journal = {
          pone: "plosone",
          pcbi: "ploscompbiol",
          pgen: "plosgenetics",
          pmed: "plosmedicine",
          pbio: "plosbiology",
          ppat: "plospathogens",
          pntd: "plosntds",
        };
        let url;
        if (plos)
          url = `https://journals.plos.org/${journal[plos[1]]}/article/figure/image?id=${encodeURIComponent(fd)}&size=large`;
        else if (asset && /^[a-z\d_.-]+\.(png|jpe?g|gif|webp)$/i.test(asset))
          url = `https://europepmc.org/articles/${article.pmcid}/bin/${encodeURIComponent(asset)}`;
        if (!url) continue;
        const comparison = await compare(url, label);
        if (comparison.includes("match")) {
          result.source_title += ` — ${label}`;
          result.credit = plain(elements(f, "attrib")[0]) || result.credit;
          return finish(
            comparison,
            "The extracted image matches an independently retrieved figure in this publication. This establishes a located occurrence, not the earliest creator, reuse permission, or validity of the underlying experiment.",
          );
        }
        if (comparison === "different") different = true;
      }
      return finish(
        different ? "No exact match" : "Attribution only",
        `The attributed article was located. Up to ${candidates.length} caption-ranked figure entries were considered; no exact visual match was established. Cropping, resizing or re-encoding can prevent a match and is not proof of falsification.`,
      );
    } else if (u?.hostname === "commons.wikimedia.org") {
      const title = decodeURIComponent(u.pathname.slice(6));
      const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url%7Cextmetadata%7Ctimestamp&titles=${encodeURIComponent(title)}`;
      const info = (await json(endpoint, signal)).query?.pages?.[0]
        ?.imageinfo?.[0];
      if (!info?.url) {
        log(
          "Wikimedia Commons",
          "No original file could be retrieved.",
          source,
        );
        return result;
      }
      result.source_url = info.descriptionurl || source;
      result.source_title = title;
      result.credit = clean(info.extmetadata?.Artist?.value);
      result.license = clean(info.extmetadata?.LicenseShortName?.value);
      log(
        "Wikimedia Commons",
        "Repository file and available attribution metadata retrieved.",
        result.source_url,
      );
      outcome = await compare(info.url, "Commons original");
    } else {
      result.source_url = u.href;
      result.source_title =
        u.hostname === "matplotlib.org"
          ? "Matplotlib gallery image"
          : "Declared repository asset";
      outcome = await compare(
        u.href,
        "Repository comparison",
        /\.csv(?:\?|$)/i.test(u.href),
      );
    }
    if (outcome.includes("match"))
      return finish(
        outcome,
        outcome === "Chart data match"
          ? "Every cached category, series label and numeric value matches the independently retrieved CSV table. This does not validate the experimental measurements."
          : "The manuscript asset matches the retrieved reference file or its decoded pixels. This is evidence of reuse of that asset, not proof of first publication, licensing, or absence of prior editing.",
      );
    return finish(
      outcome === "different"
        ? "No exact match"
        : outcome === "located"
          ? "Attribution only"
          : "Origin unresolved",
      outcome === "different"
        ? "The compared files or data were not identical. Different versions, crops, scaling and compression can explain differences; no misconduct conclusion is warranted."
        : "The accessible evidence was insufficient for an independent content match.",
    );
  } catch (e) {
    log(
      "Source retrieval",
      signal.aborted
        ? "The bounded source check timed out."
        : "Source record or comparison asset unavailable.",
    );
    return finish(
      result.source_title ? "Attribution only" : "Origin unresolved",
      "The origin could not be independently confirmed with the available reference material.",
    );
  }
}
