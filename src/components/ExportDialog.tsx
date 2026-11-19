import {
  Check,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../contexts/AppContext";
import { errorText, type Format, type Report } from "../lib/types";
import { ErrorBox, Modal } from "./UI";
export default function ExportDialog({
  report,
  onClose,
}: {
  report: Report;
  onClose: () => void;
}) {
  const { profile, notify } = useApp(),
    [format, setFormat] = useState<Format>(profile?.report_format || "PDF"),
    [submittedBy, setSubmittedBy] = useState(profile?.display_name || ""),
    [institution, setInstitution] = useState(profile?.institution || ""),
    [recipient, setRecipient] = useState(""),
    [documentPublisher, setDocumentPublisher] = useState(""),
    [retry, setRetry] = useState(0),
    [ready, setReady] = useState<{
      url: string;
      name: string;
      signature: string;
    } | null>(null),
    [err, setErr] = useState("");
  const signature = JSON.stringify([
    report.id,
    report.updated_at,
    format,
    submittedBy,
    institution,
    recipient,
    documentPublisher,
  ]);
  useEffect(() => {
    let active = true,
      url = "";
    setErr("");
    setReady(null);
    const timer = setTimeout(async () => {
      try {
        const { exportReport } = await import("../lib/export");
        const file = await exportReport(report, format, {
          submittedBy,
          institution,
          recipient,
          documentPublisher,
        });
        if (!active) return;
        url = URL.createObjectURL(file.blob);
        setReady({ url, name: file.name, signature });
      } catch (e) {
        if (active) setErr(errorText(e));
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
      if (url) setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
  }, [
    report,
    format,
    submittedBy,
    institution,
    recipient,
    documentPublisher,
    signature,
    retry,
  ]);
  const file = ready?.signature === signature ? ready : null;
  return (
    <Modal title="Export complete review" onClose={onClose}>
      <p className="modal-copy">
        All {report.claims.length} claims, {report.sources.length} sources, and{" "}
        {report.checks.length} source checks are included, along with{" "}
        {report.figures?.length || 0} visual items and their provenance records.
        Your current filters do not limit the report.
      </p>
      <details className="submission-fields">
        <summary className="text-link">Formal submission details</summary>
        <label className="field-label">
          Submitted by
          <input
            className="field"
            value={submittedBy}
            maxLength={80}
            placeholder="Name (optional)"
            onChange={(e) => setSubmittedBy(e.target.value)}
          />
        </label>
        <label className="field-label">
          Institution
          <input
            className="field"
            value={institution}
            maxLength={100}
            placeholder="Institution or department (optional)"
            onChange={(e) => setInstitution(e.target.value)}
          />
        </label>
        <label className="field-label">
          Submitted to
          <input
            className="field"
            value={recipient}
            maxLength={100}
            placeholder="Recipient or review committee (optional)"
            onChange={(e) => setRecipient(e.target.value)}
          />
        </label>
        <label className="field-label">
          Original document publisher
          <input
            className="field"
            value={documentPublisher}
            maxLength={100}
            placeholder="Only if known; not inferred from references"
            onChange={(e) => setDocumentPublisher(e.target.value)}
          />
        </label>
      </details>
      <div className="format-list">
        {(["PDF", "DOCX", "Excel", "CSV"] as Format[]).map((f) => (
          <button
            key={f}
            className={"format-option " + (format === f ? "selected" : "")}
            onClick={() => setFormat(f)}
          >
            {f === "Excel" || f === "CSV" ? (
              <FileSpreadsheet size={21} />
            ) : (
              <FileText size={21} />
            )}
            <span>
              <strong>
                {f === "PDF"
                  ? "PDF report"
                  : f === "DOCX"
                    ? "Word document"
                    : f === "Excel"
                      ? "Excel workbook"
                      : "CSV file"}
              </strong>
              <small>
                {f === "PDF"
                  ? "Print-ready, complete evidence review"
                  : f === "DOCX"
                    ? "Editable report with source listings"
                    : f === "Excel"
                      ? "Claims, sources and checks in separate sheets"
                      : "Structured, portable review content"}
              </small>
            </span>
            <i>{format === f && <Check size={12} />}</i>
          </button>
        ))}
      </div>
      {err && <ErrorBox text={err} retry={() => setRetry((x) => x + 1)} />}
      {file ? (
        <>
          <a
            className="btn btn-primary full"
            href={file.url}
            download={file.name}
            onClick={() => {
              notify(`${format} download requested`);
              setTimeout(onClose, 200);
            }}
          >
            <Download size={16} />
            Download {format} report
          </a>
          <a
            className="text-link export-preview"
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {format === "PDF"
              ? "Open PDF to preview or print"
              : "Open file in a new tab"}
            <ExternalLink size={12} />
          </a>
        </>
      ) : (
        <button className="btn btn-primary full" disabled>
          <Loader2 size={16} className="spin" />
          {err ? "File not ready" : "Preparing formal report…"}
        </button>
      )}
      <p className="fine-print download-note">
        Includes the report issuer, source publishers where available,
        methodology, findings, references, and the complete verification audit.
      </p>
    </Modal>
  );
}
