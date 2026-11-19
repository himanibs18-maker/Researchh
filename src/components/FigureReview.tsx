import { useState } from "react";
import {
  ArrowUpRight,
  FileImage,
  ImageIcon,
  Loader2,
  ScanSearch,
  ZoomIn,
} from "lucide-react";
import { Empty, ErrorBox, Modal } from "./UI";
import { api } from "../lib/supabase";
import { errorText, type ManuscriptFigure, type Report } from "../lib/types";
const safe = (v?: string) => !!v && /^https:\/\//i.test(v);
function FigureCard({
  figure: f,
  report,
  onRefresh,
}: {
  figure: ManuscriptFigure;
  report: Report;
  onRefresh: () => Promise<unknown>;
}) {
  const [zoom, setZoom] = useState(false),
    [source, setSource] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  const proof = f.provenance;
  async function check(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("process", "POST", {
        id: report.id,
        figure_id: f.id,
        source: source.trim(),
      });
      await onRefresh();
      setSource("");
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const preview =
    f.preview?.startsWith("data:image/jpeg;base64,") ||
    /^\/samples\/figures\/F\d{3}\.jpg$/.test(f.preview || "")
      ? f.preview
      : "";
  return (
    <article className="source-card figure-card">
      <div className="source-top">
        <span className="mono-label">
          {f.id} / {f.kind} · {f.location}
        </span>
        <span
          className={
            "verdict " +
            (proof.status.includes("match") && !proof.status.startsWith("No")
              ? "v-supported"
              : "v-needs-review")
          }
        >
          {proof.status}
        </span>
      </div>
      <div className="figure-layout">
        <div>
          {preview ? (
            <button
              className="figure-preview"
              onClick={() => setZoom(true)}
              aria-label={"Enlarge " + f.id}
            >
              <img
                src={preview}
                alt={f.caption || `${f.kind} extracted from ${f.location}`}
              />
              <span>
                <ZoomIn size={13} />
                Enlarge
              </span>
            </button>
          ) : (
            <div className="figure-no-preview">
              <FileImage size={29} />
              <p>No safe inline preview. Inspect the original manuscript.</p>
            </div>
          )}
          <p className="figure-note">{f.note}</p>
        </div>
        <div className="figure-evidence">
          <h3>
            {f.kind === "Native chart"
              ? "Embedded graph"
              : f.kind === "Vector page"
                ? "Vector artwork on page"
                : "Manuscript image"}
          </h3>
          {f.caption && <blockquote>{f.caption}</blockquote>}
          <p>{proof.explanation}</p>
          {f.same_as && (
            <p>
              <b>Within-document reuse:</b> the fingerprint also occurs in{" "}
              {f.same_as}. Reuse is not proof of manipulation.
            </p>
          )}
          {safe(proof.source_url) && (
            <a
              className="text-link"
              href={proof.source_url}
              target="_blank"
              rel="noreferrer"
            >
              {proof.source_title || "Open attributed source"}
              <ArrowUpRight size={13} />
            </a>
          )}
          {safe(proof.reference_url) && (
            <a
              className="text-link"
              href={proof.reference_url}
              target="_blank"
              rel="noreferrer"
            >
              Open compared reference
              <ArrowUpRight size={13} />
            </a>
          )}
          {proof.credit && (
            <p>
              <b>Source credit:</b> {proof.credit}
            </p>
          )}
          {proof.license && (
            <p>
              <b>Repository license:</b> {proof.license}
            </p>
          )}
        </div>
      </div>
      <details className="figure-audit">
        <summary>Provenance evidence & fingerprints</summary>
        <dl>
          <dt>Declared attribution</dt>
          <dd>{proof.source_input || f.declared_source || "Not supplied"}</dd>
          {f.file_sha256 && (
            <>
              <dt>Embedded file SHA-256</dt>
              <dd>{f.file_sha256}</dd>
            </>
          )}
          {f.pixel_sha256 && (
            <>
              <dt>RGBA pixel SHA-256</dt>
              <dd>{f.pixel_sha256}</dd>
            </>
          )}
          {proof.reference_hash && (
            <>
              <dt>Reference fingerprint</dt>
              <dd>{proof.reference_hash}</dd>
            </>
          )}
          {proof.checked_at && (
            <>
              <dt>Checked at</dt>
              <dd>{proof.checked_at}</dd>
            </>
          )}
        </dl>
        {proof.checks.map((c, i) => (
          <p key={i}>
            <b>{c.service}:</b> {c.outcome}{" "}
            {safe(c.url) && (
              <a
                className="text-link"
                href={c.url}
                target="_blank"
                rel="noreferrer"
              >
                Record
                <ArrowUpRight size={11} />
              </a>
            )}
          </p>
        ))}
        {!proof.checks.length && (
          <p>No external reference file has been compared.</p>
        )}
      </details>
      {!!f.previous_checks?.length && (
        <details className="figure-audit">
          <summary>
            Prior provenance checks ({f.previous_checks.length})
          </summary>
          {f.previous_checks.map((v, i) => (
            <p key={i}>
              <b>{v.status}</b> · {v.source_input || "Original extraction"} —{" "}
              {v.explanation}
            </p>
          ))}
        </details>
      )}
      {f.chart && (
        <details className="figure-audit">
          <summary>View embedded chart values</summary>
          <div className="figure-data">
            <table>
              <thead>
                <tr>
                  <th>Series</th>
                  <th>Category / X</th>
                  <th>Value / Y</th>
                </tr>
              </thead>
              <tbody>
                {f.chart.series.flatMap((s, j) =>
                  s.values.map((v, i) => (
                    <tr key={`${j}-${i}`}>
                      <td>{s.name}</td>
                      <td>{s.categories[i] ?? `Point ${i + 1}`}</td>
                      <td>{v ?? "Missing"}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {!report.is_sample && (
        <details className="figure-audit">
          <summary>Check a possible source</summary>
          <p>
            Provide a publication DOI, a Wikimedia Commons file page, or a
            direct PLOS, PMC, Matplotlib gallery, Wikimedia, or Zenodo asset.
            For a native chart, a Zenodo CSV must contain the category column
            followed by labeled series.
          </p>
          <form onSubmit={check} className="figure-check-form">
            <input
              className="field"
              required
              maxLength={480}
              aria-label={"Reference for " + f.id}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="DOI or supported source URL"
            />
            <button
              className="btn btn-white"
              disabled={busy || report.status !== "complete"}
            >
              {busy ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <ScanSearch size={14} />
              )}
              Check source
            </button>
          </form>
          {err && <ErrorBox text={err} />}
        </details>
      )}
      {zoom && (
        <Modal
          wide
          title={`${f.id} · ${f.location}`}
          onClose={() => setZoom(false)}
        >
          <img
            className="figure-enlarged"
            src={preview}
            alt={f.caption || f.kind}
          />
          <p className="modal-copy">{f.caption || f.note}</p>
        </Modal>
      )}
    </article>
  );
}
export default function FigureReview({
  report,
  onRefresh,
}: {
  report: Report;
  onRefresh: () => Promise<unknown>;
}) {
  return (
    <section className="figure-review">
      <div className="report-method">
        <ScanSearch size={16} />
        <p>
          Visual provenance is checked separately from claim support. A matching
          publication or caption is not an image match. Exact matches identify a
          located source, not first authorship or freedom from manipulation.
        </p>
      </div>
      {report.figure_notes?.map((n, i) => (
        <div key={i} className="info-box">
          {n}
        </div>
      ))}
      {report.figures?.length ? (
        report.figures.map((f) => (
          <FigureCard
            key={f.id}
            figure={f}
            report={report}
            onRefresh={onRefresh}
          />
        ))
      ) : (
        <Empty
          icon={<ImageIcon size={25} />}
          heading={
            report.figure_audit_version
              ? "No embedded figures detected"
              : "No figure audit in this review"
          }
        >
          {report.figure_audit_version
            ? "No supported images or graphical objects were detected in this manuscript."
            : "This review predates visual provenance checks. Upload the original manuscript again to examine its images and graphs."}
        </Empty>
      )}
    </section>
  );
}
