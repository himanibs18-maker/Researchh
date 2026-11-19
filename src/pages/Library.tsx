import { ArrowRight, BookOpen, Database, Info, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Empty, ErrorBox, Kicker, Spinner } from "../components/UI";
import { api } from "../lib/supabase";
import { errorText, type Paper, type SourceCheck } from "../lib/types";
import { PaperCard } from "./Report";
import SourceDirectory, {
  type DatabaseEntry,
} from "../components/SourceDirectory";
export default function Library() {
  const [params, setParams] = useSearchParams(),
    [input, setInput] = useState(params.get("q") || ""),
    q = params.get("q") || "",
    provider = params.get("provider") || "All",
    [papers, setPapers] = useState<Paper[]>([]),
    [checks, setChecks] = useState<SourceCheck[]>([]),
    [busy, setBusy] = useState(true),
    [err, setErr] = useState(""),
    [retry, setRetry] = useState(0);
  const [directory, setDirectory] = useState<DatabaseEntry[]>([]),
    [directoryError, setDirectoryError] = useState("");
  useEffect(() => {
    let active = true;
    api<DatabaseEntry[]>("library?directory=1")
      .then((rows) => {
        if (active) {
          setDirectory(rows);
          setDirectoryError("");
        }
      })
      .catch((e) => {
        if (active) setDirectoryError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setErr("");
    api<{ sources: Paper[]; checks: SourceCheck[] }>(
      "library?" + new URLSearchParams({ q, provider }),
    )
      .then((d) => {
        if (!cancelled) {
          setPapers(d.sources);
          setChecks(d.checks);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(errorText(e));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, provider, retry]);
  function search(e: FormEvent) {
    e.preventDefault();
    if (input.trim() && input.trim().length < 3) {
      setErr("Enter at least 3 characters to search.");
      return;
    }
    setParams({ q: input.trim(), provider });
  }
  return (
    <main className="page-main container library-page">
      <div className="breadcrumb">
        <Link to="/">Research</Link>
        <span>/</span>Source library
      </div>
      <Kicker>SCHOLARLY DISCOVERY</Kicker>
      <h1 className="page-title">The source library.</h1>
      <p className="page-subtitle">
        Find the original paper. Search real scholarly records by title, topic,
        or DOI.
      </p>
      <section className="library-search">
        <form onSubmit={search}>
          <Search size={20} />
          <input
            aria-label="Search scholarly papers"
            required={false}
            maxLength={300}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search a paper title, research topic, or DOI…"
          />
          <button className="btn btn-primary" disabled={busy}>
            Search
            <ArrowRight size={15} />
          </button>
        </form>
        <div className="source-filter">
          <span>DATABASE</span>
          {["All", "OpenAlex", "Crossref", "Semantic Scholar"].map((p) => (
            <button
              key={p}
              className={provider === p ? "selected" : ""}
              onClick={() => setParams({ q, provider: p })}
            >
              {p === "All" ? "All sources" : p}
            </button>
          ))}
        </div>
      </section>
      <div className="list-heading">
        <h2>{q ? "Search results" : "Referenced in our sample"}</h2>
        <span>{busy ? "Searching…" : `${papers.length} records`}</span>
      </div>
      {err && <ErrorBox text={err} retry={() => setRetry((x) => x + 1)} />}{" "}
      {busy ? (
        <Spinner
          text={
            q ? "Searching academic databases…" : "Loading the source library…"
          }
        />
      ) : (
        <>
          {checks.some((c) => c.outcome === "Provider unavailable") && (
            <div className="info-box">
              <Info size={15} />
              <span>
                {checks
                  .filter((c) => c.outcome === "Provider unavailable")
                  .map((c) => c.provider)
                  .join(", ")}{" "}
                could not complete this lookup. Available results are shown; try
                again later.
              </span>
            </div>
          )}
          <div className="source-list">
            {papers.map((p) => (
              <PaperCard key={p.id} p={p} />
            ))}
          </div>
          {!papers.length && !err && (
            <Empty icon={<Database />} heading="No records found">
              Try a more specific paper title, a DOI, or a different database.
            </Empty>
          )}
        </>
      )}
      <div className="library-note">
        <BookOpen size={16} />
        <span>
          A source match identifies a publication. It does not, by itself,
          verify a scientific claim.
        </span>
      </div>
      {directoryError && (
        <ErrorBox text={directoryError} retry={() => setRetry((x) => x + 1)} />
      )}
      <SourceDirectory entries={directory} />
    </main>
  );
}
