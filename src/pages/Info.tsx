import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Kicker } from "../components/UI";
import { VERDICTS } from "../lib/types";
export default function Info({ privacy = false }: { privacy?: boolean }) {
  return (
    <main className="container page-main info-page">
      <div className="breadcrumb">
        <Link to="/">Research</Link>
        <span>/</span>
        {privacy ? "Privacy" : "Methodology"}
      </div>
      <Kicker>{privacy ? "PRIVATE BY DESIGN" : "EVIDENCE STANDARD"}</Kicker>
      <h1 className="page-title">
        {privacy ? "Your research, protected." : "How we assess evidence."}
      </h1>
      <p className="page-subtitle">
        {privacy
          ? "A transparent account of how your documents and research data are processed."
          : "A source is a starting point, not a verdict."}
      </p>
      <div className="prose-panel">
        {privacy ? (
          <>
            <h2>Private documents and accounts</h2>
            <p>
              Original files, extracted text, reports and saved claims are
              encrypted with account-specific AES-256-GCM keys before being
              stored in Supabase. The API verifies your session and ownership
              before decrypting any record. Your profile preferences and
              workspace key are kept in your private Supabase Auth account. The
              verification worker can read authorized content; this is not
              end-to-end encryption.
            </p>
            <h2>Public-paper deployment</h2>
            <p>
              Guests can verify, save claims, and export without creating an
              account. Guest originals and reviews are encrypted in a separate
              cloud collection. A random key kept in this browser unlocks them;
              clearing browser data loses access. Guest reviews do not
              automatically move into an account. Delete a guest review in its
              console to remove its file and related bookmarks.
            </p>
            <p>
              Confidential uploads are disabled until the deployment owner
              verifies restrictive database and storage policies. In
              public-paper mode, only upload published, non-sensitive material.
              Encryption protects research content, but does not replace
              infrastructure access controls or backups.
            </p>
            <h2>What is sent to external services</h2>
            <p>
              With your permission, your claim text, reference strings and DOI
              identifiers are used to query Crossref, OpenAlex and Semantic
              Scholar. These services receive the query, not your complete
              original file. When Gemini is enabled, selected claims and
              available source abstracts are sent for assessment. Do not upload
              confidential material without the necessary permissions.
            </p>
            <h2>Retention and deletion</h2>
            <p>
              Your documents, extracted text, reviews and saved claims remain in
              your cloud workspace until you delete them. Delete a review from
              its history row to remove its original file, stored analysis, and
              related bookmarks. Your theme preference also stays on this
              device.
            </p>
            <h2>Authentication</h2>
            <p>
              Sign-in is managed by Supabase Authentication. Google sign-in uses
              an OAuth authorization flow. Your browser stores a session so your
              account remains signed in; sign out when using a shared device.
            </p>
          </>
        ) : (
          <>
            <h2>1. Start with the document</h2>
            <p>
              A PDF or DOCX must contain extractable text. Scientific statements
              and citation markers are detected with transparent sentence and
              identifier rules. Detection is not exhaustive: tables, ambiguous
              sentences and scanned images can require manual review.
            </p>
            <h2>2. Resolve scholarly records</h2>
            <p>
              DOI identifiers are looked up directly in Crossref, OpenAlex and
              Semantic Scholar. For references without a DOI, title and topic
              searches return candidate records, not verified identity matches.
              Every query records its provider, outcome and timestamp. Failed
              providers are disclosed.
            </p>
            <h2>3. Separate matching from support</h2>
            <p>
              A record match proves that a publication exists. In
              source-grounded mode, only an exact abstract-sentence match
              receives an automatic Supported verdict. Otherwise, claims remain
              Needs Review. When Gemini is configured, its assessment must link
              to a supplied source and quote text actually present in its
              abstract.
            </p>
            <div className="verdict-guide">
              {VERDICTS.map((v, i) => (
                <div key={v}>
                  <Badge status={v} />
                  <p>
                    {
                      [
                        "The available evidence directly supports the statement within its stated scope.",
                        "The evidence supports some, but not all, of the claim.",
                        "The checked sources do not substantiate the statement. This does not mean it is false.",
                        "The retrieved evidence directly conflicts with the claim.",
                        "A source explicitly revises or supersedes the claimed understanding. Age alone is insufficient.",
                        "Available evidence is incomplete, inaccessible or insufficient for a reliable assessment.",
                      ][i]
                    }
                  </p>
                </div>
              ))}
            </div>
            <h2>4. Inspect images and graphs</h2>
            <p>
              Visual checks extract PDF images, render pages containing vector
              artwork, and read embedded Word images and chart data. Each visual
              is linked to its manuscript location. Caption DOIs, Wikimedia
              Commons records and supported repository assets can be compared
              with independent reference material. Matching file bytes or pixels
              locate an identical asset, not its first author; a complete
              chart-table match does not validate experimental measurements. A
              citation, repeated image or non-match is never proof of
              fabrication.
            </p>
            <h2>5. Preserve the entire review</h2>
            <p>
              Reports retain the claim wording, linked evidence, explanations,
              DOI identifiers and source-check history. Exports include all
              findings regardless of on-screen filters. AI confidence is an
              uncalibrated estimate, not a guarantee of truth. Human scientific
              review remains essential.
            </p>
          </>
        )}
        <Link
          className="btn btn-primary"
          to={privacy ? "/verify" : "/report/sample"}
        >
          {privacy ? "Verify a document" : "Read the sample review"}
          <ArrowRight size={15} />
        </Link>
      </div>
    </main>
  );
}
