import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  CircleCheck,
  FileCheck2,
  FileOutput,
  FileScan,
  FileText,
  Fingerprint,
  GitBranch,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Kicker, Modal } from "../components/UI";
export function DatabaseLogo({ name }: { name: string }) {
  return (
    <span className={"db-logo logo-" + name.replace(" ", "-").toLowerCase()}>
      {name === "OpenAlex" ? (
        <svg width="30" height="33" viewBox="0 0 32 34" aria-hidden="true">
          <path d="m16 1 14 8v16l-14 8-14-8V9Z" fill="#b45d2f" />
          <path d="m16 1 14 8-14 8L2 9Z" fill="#e9b66c" />
          <path d="m16 17 14-8v16l-14 8Z" fill="#c7854d" />
          <path d="m16 8 8 5v9l-8 5-8-5v-9Z" fill="#f8e0ac" />
          <path d="m16 8 8 5-8 5-8-5Z" fill="#fff1cc" />
          <path d="m16 18 8-5v9l-8 5Z" fill="#d49a59" />
        </svg>
      ) : name === "Crossref" ? (
        <svg width="30" height="32" viewBox="0 0 31 33" aria-hidden="true">
          <path d="m2 1 27 9-12 5L2 10Z" fill="#f6bd3a" />
          <path d="m2 11 27 9-27 11v-9l13-5-13-4Z" fill="#db6353" />
          <path d="m2 22 13-5 14 4-27 11Z" fill="#4d9da5" />
        </svg>
      ) : (
        <svg
          width="36"
          height="33"
          viewBox="0 0 38 35"
          fill="none"
          stroke="#ae8c43"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M2 27c10-1 16-2 23-9l9-14c-1 14-9 23-31 26M6 23C16 21 24 15 27 8M5 19c8-2 14-6 17-12" />
        </svg>
      )}
      <span>{name}</span>
    </span>
  );
}
function HeroArt() {
  return (
    <div
      className="art-space"
      aria-label="Illustrated sample showing an evidence-backed claim from a research paper"
    >
      <div className="art-board">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <span className="reg r1">+</span>
        <span className="reg r2">+</span>
        <span className="reg r3">+</span>
        <div className="paper-shadow" />
        <div className="research-paper">
          <div className="paper-mast">
            <span>RESEARCH ARTICLE</span>
            <span>NEUROSCIENCE</span>
          </div>
          <h3>
            About Sleep’s Role
            <br />
            in Memory
          </h3>
          <div className="paper-by">
            B. Rasch & J. Born <span>·</span> 2013
          </div>
          <div className="paper-rule" />
          <div className="paper-abstract">ABSTRACT</div>
          <div className="paper-copy">
            Over more than a century of research has established the fact that{" "}
            <mark>sleep benefits the retention of memory.</mark>
          </div>
          <div className="brain-figure">
            <img
              src="/images/brain-engraving.webp"
              alt="Fine engraved anatomical illustration of the human brain"
            />
            <span>FIG. 01</span>
          </div>
          <div className="paper-lines">
            <i />
            <i />
            <i />
          </div>
          <div className="paper-foot">
            PHYSIOLOGICAL REVIEWS <span>681–766</span>
          </div>
        </div>
        <div className="engine-pill">
          <span className="engine-pulse" />
          <span>Evidence mapping</span>
        </div>
        <svg
          className="connector"
          viewBox="0 0 560 410"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M212 172h51q14 0 14 14v2q0 12 15 12h29"
            stroke="#9775d3"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <circle
            cx="212"
            cy="172"
            r="4"
            fill="#a079d5"
            stroke="white"
            strokeWidth="2"
          />
          <path
            d="M377 61v33q0 15-15 15h-12"
            stroke="#a68fc8"
            strokeDasharray="3 5"
          />
        </svg>
        <Link
          to="/report/sample"
          className="analysis-card"
          aria-label="Explore the sample claim verification"
        >
          <div className="analysis-title">
            <span className="scan-square">
              <ScanLine size={15} />
            </span>
            CLAIM VERIFICATION<span className="analysis-count">01</span>
          </div>
          <div className="supported-mini">
            <CircleCheck size={12} />
            Supported
          </div>
          <p>
            “Sleep supports memory
            <br />
            consolidation.”
          </p>
          <div className="analysis-source">
            <BookOpen size={14} />
            <span>Rasch & Born, 2013</span>
            <ArrowUpRight size={13} />
          </div>
          <div className="analysis-foot">
            <span className="evidence-dots">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>Source matched</span>
          </div>
        </Link>
        <div className="art-coordinate">
          <span /> FIG. 01 <b>/</b> DOCUMENT TO EVIDENCE
        </div>
        <div className="mini-cross">⌖</div>
      </div>
    </div>
  );
}
const toolkit = [
  {
    title: "Document analysis",
    tag: "EXTRACT",
    icon: FileScan,
    color: "violet",
    description:
      "Turn PDFs and Word documents into structured, reviewable claims.",
    detail:
      "Upload a text-based PDF or DOCX. Research extracts the document text and identifies declarative scientific statements, DOI identifiers, citations and reference entries.",
    action: "Upload a document",
    to: "/verify",
  },
  {
    title: "Claim verification",
    tag: "VERIFY",
    icon: ShieldCheck,
    color: "mint",
    description:
      "Understand what is supported, contradicted, or needs a closer look.",
    detail:
      "Each claim is reviewed against retrieved evidence. Six distinct verdicts preserve uncertainty, and an unavailable source is never treated as a false claim.",
    action: "Explore sample claims",
    to: "/report/sample",
  },
  {
    title: "Citation tracing",
    tag: "TRACE",
    icon: GitBranch,
    color: "peach",
    description: "Follow every citation back to its original scholarly source.",
    detail:
      "Find DOI-level matches in Crossref, OpenAlex and Semantic Scholar. Inspect authors, publication dates, abstracts and the outcome of each database check.",
    action: "Open source library",
    to: "/library",
  },
  {
    title: "Evidence reports",
    tag: "EXPORT",
    icon: FileOutput,
    color: "blue",
    description:
      "Export your complete review, with every finding and source attached.",
    detail:
      "Download a full PDF, Word, Excel or CSV report. Contradicted findings, potentially outdated information and unverifiable claims have separate listings, followed by a complete source-check record.",
    action: "View a full report",
    to: "/report/sample?export=1",
  },
];
const steps = [
  {
    title: "Bring your document",
    text: "Start with a research paper, manuscript or literature review. Upload a PDF or DOCX and let Research extract its statements and references.",
    icon: Upload,
    label: "01 / DOCUMENT INTAKE",
    action: "Choose a document",
    to: "/verify",
  },
  {
    title: "Follow the evidence",
    text: "Review the source trail for each claim. Compare the exact evidence excerpt with the original statement, and distinguish a citation match from scientific support.",
    icon: Fingerprint,
    label: "02 / EVIDENCE REVIEW",
    action: "Explore a sample review",
    to: "/report/sample",
  },
  {
    title: "Take your findings further",
    text: "Keep important claims in your workspace and export the complete review. Every report includes the evidence, limitations and source checks, not just a verdict.",
    icon: ArrowDownToLine,
    label: "03 / REPORT EXPORT",
    action: "Explore report formats",
    to: "/report/sample?export=1",
  },
];
export default function Landing() {
  const [feature, setFeature] = useState<number | null>(null),
    [step, setStep] = useState(0),
    [faq, setFaq] = useState<number | null>(null);
  const s = steps[step],
    SI = s.icon;
  return (
    <>
      <section className="hero">
        <div className="hero-dots" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <Sparkles size={12} />
              AI-POWERED RESEARCH VERIFICATION
            </div>
            <h1>
              Every claim.
              <br />
              <em>Real evidence.</em>
            </h1>
            <p>
              Verify scientific claims, trace citations, and turn research
              documents into transparent, evidence-backed reviews.
            </p>
            <div className="hero-buttons">
              <Link className="btn btn-primary" to="/verify">
                <FileCheck2 size={17} />
                Verify a document
                <ArrowRight size={16} />
              </Link>
              <Link className="btn btn-white" to="/report/sample">
                <BookOpen size={16} />
                View sample report
              </Link>
            </div>
            <div className="hero-notes">
              <span>
                <LockKeyhole size={13} />
                Private by design
              </span>
              <i />
              <span>
                <FileText size={13} />
                PDF & DOCX support
              </span>
            </div>
          </div>
          <HeroArt />
        </div>
      </section>
      <section
        className="database-strip"
        aria-label="Scholarly database integrations"
      >
        <div className="container database-row">
          <div className="database-label">
            <span />
            CONNECTED TO LEADING
            <br />
            ACADEMIC DATABASES
          </div>
          {["OpenAlex", "Crossref", "Semantic Scholar"].map((n) => (
            <Link
              key={n}
              to={"/library?provider=" + encodeURIComponent(n)}
              aria-label={"Browse " + n + " sources"}
            >
              <DatabaseLogo name={n} />
            </Link>
          ))}
        </div>
      </section>
      <section className="toolkit-section container" id="toolkit">
        <Kicker>THE VERIFICATION TOOLKIT</Kicker>
        <div className="section-title-row">
          <h2>Rigor at every step.</h2>
          <span className="section-aside">
            One workspace. From paper to proof.
          </span>
        </div>
        <div className="toolkit-grid">
          {toolkit.map((f, i) => (
            <button
              className="tool-card"
              key={f.title}
              onClick={() => setFeature(i)}
            >
              <div className="tool-card-top">
                <span className={"tool-icon " + f.color}>
                  <f.icon size={24} strokeWidth={1.5} />
                </span>
                <span className="tool-index">
                  0{i + 1} / {f.tag}
                </span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
              <span className="tool-arrow">
                <ArrowUpRight size={17} />
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="workflow-section" id="workflow">
        <div className="container workflow-grid">
          <div>
            <Kicker>HOW IT WORKS</Kicker>
            <h2>
              A clear path from
              <br />
              paper to <em>proof.</em>
            </h2>
            <p className="muted">
              An evidence-first workflow, built for careful research.
            </p>
            <div className="step-tabs">
              {steps.map((x, i) => (
                <button
                  className={step === i ? "selected" : ""}
                  onClick={() => setStep(i)}
                  key={x.title}
                >
                  <span>0{i + 1}</span>
                  {x.title}
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          </div>
          <div className="step-detail">
            <span className="step-illustration">
              <SI size={49} strokeWidth={1.25} />
            </span>
            <div className="mono-label">{s.label}</div>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <Link className="text-link" to={s.to}>
              {s.action}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
      <section className="container faqs">
        <div>
          <Kicker>GOOD TO KNOW</Kicker>
          <h2>Research, explained.</h2>
        </div>
        <div>
          {[
            {
              q: "Does a verified citation mean a claim is true?",
              a: "No. A DOI match confirms the identity of a scholarly work. A claim verdict requires relevant evidence from its content. If the evidence is insufficient, the claim stays marked Needs Review.",
            },
            {
              q: "What is included in a complete report?",
              a: "Every detected claim, its verdict, available confidence and evidence, all matched papers and DOIs, every citation, and each database lookup. Contradicted, possibly outdated and unverifiable findings are listed separately.",
            },
            {
              q: "Are my research documents private?",
              a: "Files and reviews are encrypted with account-specific keys. This deployment accepts public, non-confidential papers until infrastructure isolation is certified. When you authorize verification, scholarly services receive citation identifiers and search phrases.",
            },
            {
              q: "Which document formats can I check?",
              a: "Upload a text-based PDF or a DOCX file up to 3 MB. Scanned documents must have OCR text before upload. Export your completed review as PDF, DOCX, Excel or CSV.",
            },
          ].map((x, i) => (
            <div className="faq-item" key={x.q}>
              <button
                onClick={() => setFaq(faq === i ? null : i)}
                aria-expanded={faq === i}
              >
                {x.q}
                <ChevronDown size={16} className={faq === i ? "rotate" : ""} />
              </button>
              {faq === i && <p>{x.a}</p>}
            </div>
          ))}
        </div>
      </section>
      <section className="bottom-cta container">
        <div>
          <Kicker>YOUR RESEARCH WORKSPACE</Kicker>
          <h2>Start with one document.</h2>
          <p>Let the evidence guide your next review.</p>
        </div>
        <Link className="btn btn-primary" to="/verify">
          Verify a document
          <ArrowRight size={16} />
        </Link>
      </section>
      {feature !== null && (
        <Modal title={toolkit[feature].title} onClose={() => setFeature(null)}>
          <span className="mono-label">
            CAPABILITY 0{feature + 1} / {toolkit[feature].tag}
          </span>
          <p className="modal-copy">{toolkit[feature].detail}</p>
          <Link className="btn btn-primary" to={toolkit[feature].to}>
            {toolkit[feature].action}
            <ArrowRight size={16} />
          </Link>
        </Modal>
      )}
    </>
  );
}
