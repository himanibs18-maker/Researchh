import {
  ArrowRight,
  BookOpen,
  FileCheck2,
  FileText,
  FolderLock,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WorkspaceNav } from "../components/Shell";
import { ErrorBox, Kicker } from "../components/UI";
import { useApp } from "../contexts/AppContext";
import { api, offlineVerificationDemo } from "../lib/supabase";
import { errorText } from "../lib/types";
export default function Verify() {
  const {
      user,
      profile,
      pendingFile: file,
      setPendingFile: setFile,
    } = useApp(),
    [drag, setDrag] = useState(false),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    input = useRef<HTMLInputElement>(null),
    nav = useNavigate();
  function choose(f?: File) {
    setErr("");
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      setErr(
        "Choose a PDF or DOCX document. Other file types cannot be verified.",
      );
      return;
    }
    if (f.size > 3 * 1024 * 1024 || f.size === 0) {
      setErr("Choose a nonempty document of 3 MB or less.");
      return;
    }
    setFile(f);
  }
  async function submit() {
    setErr("");
    if (!file) {
      setErr("Upload a research document to continue.");
      return;
    }
    if (!consent) {
      setErr("Please confirm permission to process this document.");
      return;
    }
    setBusy(true);
    try {
      if (offlineVerificationDemo) {
        sessionStorage.setItem("offline-demo-file", file.name);
        setFile(null);
        nav("/report/offline-demo");
        return;
      }
      const content = await new Promise<string>((resolve, reject) => {
        const f = new FileReader();
        f.onload = () => resolve(String(f.result).split(",")[1]);
        f.onerror = () => reject(new Error("This file could not be read."));
        f.readAsDataURL(file);
      });
      const r = await api<{ id: string }>("reports", "POST", {
        file_name: file.name,
        file_base64: content,
        consent: true,
        public_material: !profile?.private_uploads_enabled && consent,
      });
      setFile(null);
      nav("/report/" + r.id);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function useExample() {
    setErr("");
    try {
      const response = await fetch("/samples/sleep-and-learning-review.pdf");
      if (!response.ok)
        throw new Error("The example document could not be loaded.");
      choose(
        new File([await response.blob()], "sleep-and-learning-review.pdf", {
          type: "application/pdf",
        }),
      );
    } catch (error) {
      setErr(errorText(error));
    }
  }
  return (
    <>
      {user && <WorkspaceNav />}
      <main className="page-main container">
        <div className="breadcrumb">
          <Link to="/">Research</Link>
          <span>/</span>Document verification
        </div>
        <Kicker>NEW VERIFICATION</Kicker>
        <h1 className="page-title">Start with your document.</h1>
        <p className="page-subtitle">
          Extract the claims. Trace the citations. Review the evidence.
        </p>
        {!profile?.private_uploads_enabled && (
          <div className="info-box">
            <ShieldCheck size={16} />
            <span>
              <b>Public-paper mode.</b> Use published research or
              non-confidential sample documents only. Confidential uploads are
              disabled pending the infrastructure security check.
            </span>
          </div>
        )}
        <div className="upload-layout">
          <section className="panel upload-panel">
            <div className="panel-heading">
              <span className="number-tile">01</span>
              <div>
                <h2>Upload a research document</h2>
                <p>
                  Upload a text-based PDF or DOCX to review its claims, images,
                  and graphs.
                </p>
              </div>
            </div>
            <input
              type="file"
              ref={input}
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              aria-label="Choose research document"
              disabled={busy}
              onChange={(e) => choose(e.target.files?.[0])}
            />
            {file ? (
              <div className="file-selected">
                <span className="file-icon">
                  <FileText size={27} />
                </span>
                <div>
                  <strong>{file.name}</strong>
                  <small>
                    {(file.size / 1024).toFixed(1)} KB · Ready to extract
                  </small>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Remove document"
                  disabled={busy}
                  onClick={() => {
                    setFile(null);
                    if (input.current) input.current.value = "";
                  }}
                >
                  <X size={17} />
                </button>
              </div>
            ) : (
              <button
                className={"dropzone " + (drag ? "dragging" : "")}
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  choose(e.dataTransfer.files[0]);
                }}
              >
                <span className="upload-symbol">
                  <UploadCloud size={32} strokeWidth={1.5} />
                </span>
                <strong>Drop your document here</strong>
                <span>
                  or <b>browse files</b> on your device
                </span>
                <small>PDF or DOCX · Up to 3 MB · Text-based documents</small>
              </button>
            )}
            {!file && (
              <button
                className="text-link sample-file-link"
                onClick={useExample}
              >
                <FileText size={13} />
                Use the sample PDF instead
                <ArrowRight size={13} />
              </button>
            )}
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                {!profile?.private_uploads_enabled &&
                  "This is public, non-confidential material. "}
                I have permission to process this document and send its claims
                and citation search terms to scholarly databases, and to Gemini
                when enabled. Figure source links and DOIs may be queried at
                their repositories; manuscript images are not sent to a
                reverse-image service.
              </span>
            </label>
            {err && <ErrorBox text={err} />}
            <button
              className="btn btn-primary full"
              onClick={submit}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 size={17} className="spin" />
                  Uploading & extracting text…
                </>
              ) : (
                <>
                  <FileCheck2 size={17} />
                  {user ? "Start verification" : "Verify as a guest"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <div className="secure-caption">
              <FolderLock size={14} />
              {user
                ? "Original files and reports are encrypted for your account."
                : "No sign-in required. Your encrypted guest reviews are accessible from this browser."}
            </div>
          </section>
          <aside className="upload-aside">
            <Kicker>WHAT HAPPENS NEXT</Kicker>
            {[
              {
                t: "Extract & identify",
                d: "Identify scientific statements, reference entries and DOI identifiers.",
              },
              {
                t: "Trace sources & figures",
                d: "Inspect embedded artwork, graph data and figure attributions. Compare available reference assets without assuming a citation proves authenticity.",
              },
              {
                t: "Review & export",
                d: "Inspect the evidence and download the complete review in four formats.",
              },
            ].map((v, i) => (
              <div className="next-step" key={v.t}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{v.t}</h3>
                  <p>{v.d}</p>
                </div>
              </div>
            ))}
            <div className="aside-note">
              <BookOpen size={18} />
              <div>
                <strong>Want to see the result?</strong>
                <Link to="/report/sample">
                  Explore a sample report
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </aside>
        </div>
        <div className="method-note">
          <ShieldCheck size={18} />
          <p>
            <b>Evidence, not assumptions.</b> Citation matches are not proof of
            a claim. Records without sufficient evidence remain marked Needs
            Review.
          </p>
        </div>
      </main>
    </>
  );
}
