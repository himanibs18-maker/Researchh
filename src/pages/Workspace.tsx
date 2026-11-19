import {
  ArrowUpRight,
  Bookmark,
  BookOpen,
  CheckCheck,
  ChevronRight,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WorkspaceNav } from "../components/Shell";
import WorkspaceSignal from "../components/WorkspaceSignal";
import {
  Badge,
  Empty,
  ErrorBox,
  Kicker,
  Modal,
  Spinner,
} from "../components/UI";
import { useApp } from "../contexts/AppContext";
import { api } from "../lib/supabase";
import {
  dateLabel,
  errorText,
  type Report,
  type Bookmark as Saved,
  VERDICTS,
} from "../lib/types";
export default function Workspace() {
  const { user, profile, notify } = useApp(),
    [rows, setRows] = useState<Report[]>([]),
    [saved, setSaved] = useState<Saved[]>([]),
    [busy, setBusy] = useState(true),
    [err, setErr] = useState(""),
    [q, setQ] = useState(""),
    [deleting, setDeleting] = useState<Report | null>(null),
    [removing, setRemoving] = useState(false),
    [filter, setFilter] = useState("All documents");
  const load = useCallback(async () => {
    setErr("");
    try {
      const [r, b] = await Promise.all([
        api<Report[]>("reports"),
        api<Saved[]>("bookmarks"),
      ]);
      setRows(r.filter((item) => !item.is_sample));
      setSaved(b);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const name =
    profile?.display_name?.split(" ")[0] ||
    user?.user_metadata.full_name?.split(" ")[0];
  const reviewCode = (id: string) =>
    "REV–" + id.replace(/^g-/, "").slice(0, 8).toUpperCase();
  const claims = rows.flatMap((r) => r.claims),
    list = rows.filter(
      (r) =>
        `${reviewCode(r.id)} ${dateLabel(r.created_at)} ${r.format}`
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (filter === "All documents" ||
          (filter === "Completed"
            ? r.status === "complete"
            : r.status !== "complete")),
    );
  async function remove() {
    if (!deleting) return;
    setRemoving(true);
    try {
      await api("reports", "DELETE", { id: deleting.id });
      await load();
      setDeleting(null);
      notify("Document and review permanently deleted");
    } catch (e) {
      setErr(errorText(e));
      setDeleting(null);
    } finally {
      setRemoving(false);
    }
  }
  async function original(id: string) {
    try {
      const r = await api<{ name: string; mime: string; content: string }>(
        `reports?id=${id}&download=1`,
      );
      const bytes = Uint8Array.from(atob(r.content), (v) => v.charCodeAt(0));
      const { downloadBlob } = await import("../lib/export");
      downloadBlob(new Blob([bytes], { type: r.mime }), r.name);
    } catch (e) {
      setErr(errorText(e));
    }
  }
  return (
    <>
      <WorkspaceNav />
      <main className="container page-main">
        <WorkspaceSignal name={name} />
        {err && <ErrorBox text={err} retry={load} />}{" "}
        {busy ? (
          <Spinner text="Loading your workspace…" />
        ) : (
          <>
            <div className="dashboard-stats">
              {[
                { n: rows.length, t: "Documents", i: FileText, c: "violet" },
                {
                  n: claims.length,
                  t: "Detected claims",
                  i: FileCheck2,
                  c: "mint",
                },
                {
                  n: claims.filter((c) => c.status === "Supported").length,
                  t: "Supported claims",
                  i: CheckCheck,
                  c: "peach",
                },
                { n: saved.length, t: "Saved claims", i: Bookmark, c: "blue" },
              ].map((s) => (
                <div className="stat-card" key={s.t}>
                  <span className={"tool-icon " + s.c}>
                    <s.i size={20} />
                  </span>
                  <strong>{s.n}</strong>
                  <small>{s.t}</small>
                </div>
              ))}
            </div>
            {claims.length > 0 && (
              <div className="verdict-distribution">
                <div className="mono-label">VERDICT DISTRIBUTION</div>
                <div className="distribution-bar">
                  {VERDICTS.map((v, i) => (
                    <span
                      key={v}
                      title={`${v}: ${claims.filter((c) => c.status === v).length}`}
                      style={{
                        width: `${(100 * claims.filter((c) => c.status === v).length) / claims.length}%`,
                        background: [
                          "#75a895",
                          "#b7ab79",
                          "#d4996e",
                          "#c47f85",
                          "#b697ca",
                          "#a8a4b7",
                        ][i],
                      }}
                    />
                  ))}
                </div>
                <div className="distribution-legend">
                  {VERDICTS.filter((v) =>
                    claims.some((c) => c.status === v),
                  ).map((v) => (
                    <span key={v}>
                      {v}: <b>{claims.filter((c) => c.status === v).length}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <section aria-label="Verification history">
              <div className="list-heading">
                <h2>Verification history</h2>
                <span>{rows.length} documents</span>
              </div>
              <div className="filter-row">
                <div className="search-field">
                  <Search size={16} />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Find a document…"
                    aria-label="Find a verification job"
                  />
                </div>
                <select
                  className="field select-small"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="Filter history"
                >
                  <option>All documents</option>
                  <option>Completed</option>
                  <option>In progress</option>
                </select>
              </div>
              {list.length ? (
                <div className="history-list">
                  {list.map((r) => (
                    <div className="history-item" key={r.id}>
                      <span className="file-icon">
                        <FileText size={23} />
                      </span>
                      <Link to={"/report/" + r.id}>
                        <strong>{r.format} document review</strong>
                        <small>
                          {dateLabel(r.created_at)} · {reviewCode(r.id)} ·{" "}
                          {r.claims.length} claims
                        </small>
                      </Link>
                      <span
                        className={
                          "status-pill " +
                          (r.status === "complete" ? "done" : "")
                        }
                      >
                        {r.status === "complete" ? "Complete" : "In progress"}
                      </span>
                      <button
                        className="icon-btn"
                        aria-label={"Download original for " + reviewCode(r.id)}
                        onClick={() => original(r.id)}
                      >
                        <Download size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label={"Delete " + reviewCode(r.id)}
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 size={15} />
                      </button>
                      <Link
                        className="icon-btn"
                        to={"/report/" + r.id}
                        aria-label="Open review"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={<FolderOpen size={30} />}
                  heading={
                    rows.length
                      ? "No matching documents"
                      : "Your first review starts here."
                  }
                  to="/verify"
                  label="Verify a document"
                >
                  {rows.length
                    ? "Try a different search or status filter."
                    : user
                      ? "Upload a research document to build your personal evidence library. Your history will be available on every device."
                      : "Upload a research document to build your evidence library. Guest reviews remain accessible from this browser."}
                </Empty>
              )}
            </section>
            <Link className="sample-banner" to="/report/sample">
              <BookOpen size={25} />
              <span>
                <strong>Explore a complete sample review</strong>
                <small>
                  See how claims, sources, and verification reports fit
                  together.
                </small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
          </>
        )}
      </main>
      {deleting && (
        <Modal
          title="Delete this review?"
          onClose={() => {
            if (!removing) setDeleting(null);
          }}
        >
          <p className="modal-copy">
            {reviewCode(deleting.id)}, its original document, and associated
            saved claims will be permanently deleted. This cannot be undone.
          </p>
          <div className="button-row">
            <button
              className="btn btn-white"
              disabled={removing}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={remove}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Trash2 size={16} />
              )}
              Delete review
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function SavedClaims() {
  const { user } = useApp();
  const [rows, setRows] = useState<Saved[]>([]),
    [busy, setBusy] = useState(true),
    [err, setErr] = useState(""),
    [q, setQ] = useState("");
  async function load() {
    try {
      setRows(await api<Saved[]>("bookmarks"));
      setErr("");
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function remove(id: string) {
    try {
      await api("bookmarks", "DELETE", { id });
      await load();
    } catch (e) {
      setErr(errorText(e));
    }
  }
  return (
    <>
      <WorkspaceNav />
      <main className="container page-main">
        <Kicker>PERSONAL COLLECTION</Kicker>
        <h1 className="page-title">Saved claims.</h1>
        <p className="page-subtitle">
          {user
            ? "An evidence collection that travels with your account."
            : "Evidence bookmarked in this browser’s guest workspace."}
        </p>
        {err && <ErrorBox text={err} retry={load} />}
        <div className="filter-row">
          <div className="search-field">
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search saved claims…"
              aria-label="Search saved claims"
            />
          </div>
          <span className="muted">{rows.length} saved</span>
        </div>
        {busy ? (
          <Spinner />
        ) : rows.filter((r) =>
            r.claim_text.toLowerCase().includes(q.toLowerCase()),
          ).length ? (
          rows
            .filter((r) => r.claim_text.toLowerCase().includes(q.toLowerCase()))
            .map((b) => (
              <article className="saved-card" key={b.id}>
                <div className="claim-top">
                  <span className="mono-label">{b.claim_id}</span>
                  <Badge status={b.status} />
                  <button
                    className="icon-btn save-claim"
                    onClick={() => remove(b.id)}
                    aria-label="Remove saved claim"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <h3>{b.claim_text}</h3>
                <Link className="text-link" to={"/report/" + b.report_id}>
                  {b.report_title}
                  <ArrowUpRight size={14} />
                </Link>
              </article>
            ))
        ) : (
          <Empty
            icon={<Bookmark size={26} />}
            heading={
              q ? "No matching saved claims" : "Keep the evidence that matters."
            }
            to="/report/sample"
            label="Explore a sample report"
          >
            {q
              ? "Try another search term."
              : "Use the bookmark beside any claim in a report to save it here."}
          </Empty>
        )}
      </main>
    </>
  );
}
