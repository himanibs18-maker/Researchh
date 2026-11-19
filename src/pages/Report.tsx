import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  Filter,
  Info,
  Layers3,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ExportDialog from "../components/ExportDialog";
import FigureReview from "../components/FigureReview";
import { WorkspaceNav } from "../components/Shell";
import { Badge, Empty, ErrorBox, Kicker, Spinner } from "../components/UI";
import { useApp } from "../contexts/AppContext";
import { api, offlineVerificationDemo } from "../lib/supabase";
import { offlineReport } from "../lib/offline-report";
import {
  dateLabel,
  errorText,
  VERDICTS,
  type Claim,
  type Paper,
  type Report as Review,
  type Bookmark as Saved,
} from "../lib/types";
export function PaperCard({ p }: { p: Paper }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="source-card">
      <div className="source-top">
        <span className="mono-label">
          {p.year || "N.D."} / SCHOLARLY RECORD
        </span>
        <div className="provider-tags">
          {p.providers.map((x) => (
            <span key={x}>
              {p.record_links?.[x]?.startsWith("https://") ? (
                <a
                  href={p.record_links[x]}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${x} record`}
                >
                  {x}
                </a>
              ) : (
                x
              )}
            </span>
          ))}
        </div>
      </div>
      <h3>
        <a href={p.url} target="_blank" rel="noreferrer">
          {p.title}
          <ArrowUpRight size={17} />
        </a>
      </h3>
      <p className="paper-meta">
        {p.authors || "Authors not provided"} <span>·</span>{" "}
        {p.journal || "Venue not provided"} <span>·</span> Publisher:{" "}
        {p.publisher || "Not reported by the source"}
      </p>
      <div className="source-bottom">
        <a href={p.url} target="_blank" rel="noreferrer" className="doi">
          {p.doi ? "DOI: " + p.doi : "Open source record"}
          <ExternalLink size={12} />
        </a>
        <button className="text-link" onClick={() => setOpen(!open)}>
          {open ? "Hide abstract" : "View abstract"}
          <ChevronDown size={13} />
        </button>
      </div>
      {open && (
        <div className="abstract-block">
          <b>Available abstract</b>
          <p>
            {p.abstract ||
              "This database does not provide an abstract. Open the original record for more information."}
          </p>
          <div className="source-record-links">
            {Object.entries(p.record_links || {})
              .filter(([, url]) => /^https:\/\//.test(url))
              .map(([provider, url]) => (
                <a
                  className="text-link"
                  key={provider}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {provider} record
                  <ArrowUpRight size={13} />
                </a>
              ))}
            {p.open_access_url && (
              <a
                className="text-link"
                href={p.open_access_url}
                target="_blank"
                rel="noreferrer"
              >
                Open-access version
                <ArrowUpRight size={13} />
              </a>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
export default function ReportPage() {
  const { id } = useParams(),
    [params] = useSearchParams(),
    { user, notify } = useApp(),
    [report, setReport] = useState<Review | null>(null),
    [err, setErr] = useState(""),
    [tab, setTab] = useState("Claims"),
    [filter, setFilter] = useState("All verdicts"),
    [query, setQuery] = useState(""),
    [open, setOpen] = useState<string | null>("C001"),
    [exporting, setExporting] = useState(params.get("export") === "1"),
    [bookmarks, setBookmarks] = useState<Saved[]>([]),
    [saving, setSaving] = useState("");
  const bookmarkPath = id?.startsWith("g-") ? "bookmarks?guest=1" : "bookmarks";
  const sample =
      id === "sample" || id === "a258d5a1-0b16-4b22-8dfd-560c40000101",
    load = useCallback(async () => {
      if (offlineVerificationDemo && id === "offline-demo") {
        const r = offlineReport(
          sessionStorage.getItem("offline-demo-file") || undefined,
        );
        setReport(r);
        setErr("");
        return r;
      }
      try {
        const r = await api<Review>(
          "reports?" +
            (sample ? "sample=1" : "id=" + encodeURIComponent(id || "")),
        );
        setReport(r);
        setErr("");
        return r;
      } catch (e) {
        setErr(errorText(e));
        return null;
      }
    }, [id, sample]);
  useEffect(() => {
    setReport(null);
    void load();
  }, [load]);
  useEffect(() => {
    if (offlineVerificationDemo && id === "offline-demo") return;
    void api<Saved[]>(bookmarkPath)
      .then(setBookmarks)
      .catch((e) => setErr(errorText(e)));
  }, [user, bookmarkPath]);
  useEffect(() => {
    if (!report?.status || report.status === "complete" || sample) return;
    let active = true,
      busy = false;
    async function refresh() {
      if (!active || busy) return;
      busy = true;
      try {
        await api("process", "POST", { id });
        if (active) await load();
      } catch (e) {
        if (active) setErr(errorText(e));
      } finally {
        busy = false;
      }
    }
    const t = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [id, report?.status, sample, load]);
  async function toggle(c: Claim) {
    setSaving(c.id);
    try {
      const exists = bookmarks.find(
        (b) => b.report_id === report?.id && b.claim_id === c.id,
      );
      await api(
        bookmarkPath,
        exists ? "DELETE" : "POST",
        exists ? { id: exists.id } : { report_id: report?.id, claim_id: c.id },
      );
      setBookmarks(await api<Saved[]>(bookmarkPath));
      notify(
        exists
          ? "Claim removed from saved claims"
          : "Claim saved to your workspace",
      );
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setSaving("");
    }
  }
  if (!report)
    return (
      <main className="container page-main">
        {err ? (
          <ErrorBox text={err} retry={load} />
        ) : (
          <Spinner text="Opening the evidence review…" />
        )}
      </main>
    );
  const r = report,
    claims = r.claims.filter(
      (c) =>
        (filter === "All verdicts" || c.status === filter) &&
        c.text.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <>
      {(!sample || user) && <WorkspaceNav />}
      <main className="page-main container report-page">
        <div className="breadcrumb">
          <Link to="/workspace">{user ? "Workspace" : "Guest workspace"}</Link>
          <span>/</span>
          {sample ? "Sample review" : "Verification report"}
          {sample && (
            <a
              className="sample-download"
              href="/samples/sleep-and-learning-review.pdf"
              download
            >
              <Download size={12} />
              Sample document
            </a>
          )}
        </div>
        <div className="report-heading">
          <div>
            <Kicker>
              {sample ? "CURATED SAMPLE REVIEW" : "DOCUMENT VERIFICATION"}
            </Kicker>
            <h1 className="page-title">{r.title}</h1>
            <div className="report-meta">
              <span>
                <FileText size={13} />
                {r.file_name}
              </span>
              <i /> {dateLabel(r.created_at)} <i />
              {r.format}
              <i />
              <span>Published by Research</span>
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={r.status !== "complete"}
            title={
              r.status === "complete"
                ? "Export the complete formal submission"
                : "Final export will be available after all checks finish."
            }
            onClick={() => setExporting(true)}
          >
            <Download size={16} />
            {r.status === "complete"
              ? "Export report"
              : "Verification in progress"}
          </button>
        </div>
        {err && <ErrorBox text={err} retry={load} />}
        <div className="review-summary">
          {[
            { n: r.claims.length, label: "Detected claims", i: FileSearch },
            { n: r.sources.length, label: "Unique sources", i: BookOpen },
            { n: r.checks.length, label: "Source checks", i: ClipboardCheck },
            {
              n: r.claims.filter((c) => c.status === "Needs Review").length,
              label: "Needs review",
              i: Layers3,
            },
          ].map((item) => (
            <div key={item.label}>
              <item.i size={18} />
              <strong>{item.n}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        {r.status !== "complete" && (
          <div className="processing-box">
            <Loader2 className="spin" size={20} />
            <div>
              <strong>Checking scholarly sources…</strong>
              <p>
                {r.processed} of {r.task_count} research queries completed.
                Progress is saved in the cloud; reopening this review resumes
                unfinished checks.
              </p>
              <progress value={r.processed} max={Math.max(1, r.task_count)} />
            </div>
          </div>
        )}
        <div className="report-method">
          <Info size={16} />
          <p>
            {sample
              ? "An educational review of illustrative claims using real published abstracts. Sample verdicts are curated, not AI-generated."
              : r.review_method.includes("Gemini")
                ? "Evidence-grounded AI assessment. Scores are model estimates, not probabilities of scientific truth."
                : "Source-grounded mode: exact abstract matches are identified. Other claims remain Needs Review without an AI assessment."}
          </p>
        </div>
        <div className="tab-bar">
          {[
            "Claims",
            "Sources",
            "Source checks",
            "Citations",
            "Figures & graphs",
          ].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? "selected" : ""}
            >
              {t}
              <small>
                {t === "Claims"
                  ? r.claims.length
                  : t === "Sources"
                    ? r.sources.length
                    : t === "Figures & graphs"
                      ? r.figures?.length || 0
                      : t === "Citations"
                        ? r.citations.length
                        : r.checks.length}
              </small>
            </button>
          ))}
        </div>
        {tab === "Claims" ? (
          <>
            <div className="filter-row">
              <div className="search-field">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search claims…"
                  aria-label="Search claims"
                />
              </div>
              <div className="select-filter">
                <Filter size={14} />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="Filter verdicts"
                >
                  <option>All verdicts</option>
                  {VERDICTS.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="claim-list">
              {claims.map((c) => {
                const saved = bookmarks.some(
                  (b) => b.report_id === r.id && b.claim_id === c.id,
                );
                return (
                  <article
                    className={
                      "claim-card " + (open === c.id ? "expanded" : "")
                    }
                    key={c.id}
                  >
                    <div className="claim-top">
                      <span className="mono-label">
                        CLAIM {c.id.replace("C", "")}
                      </span>
                      <Badge status={c.status} />
                      <button
                        className={
                          "icon-btn save-claim " + (saved ? "is-saved" : "")
                        }
                        aria-label={saved ? "Unsave claim" : "Save claim"}
                        onClick={() => toggle(c)}
                        disabled={saving === c.id}
                      >
                        {saving === c.id ? (
                          <Loader2 className="spin" size={16} />
                        ) : saved ? (
                          <BookmarkCheck size={17} />
                        ) : (
                          <Bookmark size={17} />
                        )}
                      </button>
                    </div>
                    <button
                      className="claim-question"
                      onClick={() => setOpen(open === c.id ? null : c.id)}
                      aria-expanded={open === c.id}
                    >
                      <h3>{c.text}</h3>
                      <ChevronDown
                        className={open === c.id ? "rotate" : ""}
                        size={17}
                      />
                    </button>
                    {open === c.id && (
                      <div className="claim-detail">
                        <div className="mono-label">
                          <Sparkles size={12} />
                          ASSESSMENT
                        </div>
                        <p>{c.explanation}</p>
                        {c.evidence && <blockquote>“{c.evidence}”</blockquote>}
                        <div className="claim-source-list">
                          {c.source_ids.map((s) => {
                            const p = r.sources.find((x) => x.id === s);
                            return p ? (
                              <a
                                key={s}
                                target="_blank"
                                rel="noreferrer"
                                href={p.url}
                              >
                                <BookOpen size={14} />
                                <span>
                                  {p.title}
                                  <small>
                                    {p.year} · {p.doi || p.journal}
                                  </small>
                                </span>
                                <ArrowUpRight size={14} />
                              </a>
                            ) : null;
                          })}
                        </div>
                        <div className="claim-method">
                          <span>{c.method}</span>
                          <span>
                            Confidence:{" "}
                            {c.confidence === null
                              ? "not assessed"
                              : `${c.confidence}% ${c.method.includes("Exact") ? "text match" : "model estimate"}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {!claims.length && (
                <Empty icon={<Search />} heading="No matching claims">
                  Try another search or choose a different verdict.
                </Empty>
              )}
            </div>
          </>
        ) : tab === "Figures & graphs" ? (
          <FigureReview report={r} onRefresh={load} />
        ) : tab === "Sources" ? (
          <div className="source-list">
            {r.sources.map((p) => (
              <PaperCard key={p.id} p={p} />
            ))}
            {!r.sources.length && (
              <Empty
                icon={<BookOpen />}
                heading="No scholarly records retrieved"
              >
                Check the source audit for unavailable providers or unresolved
                references.
              </Empty>
            )}
          </div>
        ) : tab === "Source checks" ? (
          <div className="audit-list">
            {r.checks.map((c, i) => (
              <div className="audit-row" key={i}>
                <span className="audit-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{c.provider}</strong>
                  <p>{c.query}</p>
                  <small>
                    {c.source_ids.join(" · ") ||
                      c.detail ||
                      "No matching records"}{" "}
                    · {dateLabel(c.checked_at)}
                  </small>
                </div>
                <span
                  className={
                    "audit-outcome " +
                    (c.outcome.includes("unavailable") ? "warn" : "")
                  }
                >
                  {c.outcome}
                </span>
              </div>
            ))}
            {!r.checks.length && (
              <p className="muted">No source checks have completed yet.</p>
            )}
          </div>
        ) : (
          <div className="audit-list">
            {r.citations.map((c, i) => (
              <div className="audit-row" key={i}>
                <span className="audit-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className="mono-label">{c.kind}</span>
                  <p>{c.value}</p>
                  <small>
                    {c.kind === "DOI" &&
                    r.sources.some((s) => s.doi === c.value.toLowerCase())
                      ? "DOI resolved to a scholarly record"
                      : "Detected in document; see the source checks for verification details."}
                  </small>
                </div>
              </div>
            ))}
            {!r.citations.length && (
              <p className="muted">
                No explicit references or DOI identifiers were detected.
              </p>
            )}
          </div>
        )}
        <div className="report-end">
          <ShieldCheck size={17} />
          <span>Scientific decisions require expert review.</span>
          <Link to="/methodology">
            Read the methodology
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </main>
      {exporting && (
        <ExportDialog report={r} onClose={() => setExporting(false)} />
      )}
    </>
  );
}
