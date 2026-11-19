# Research: deployment and operational status

## What is available

A Vite/React/TypeScript frontend, Vercel Node serverless API, Supabase Auth, PostgreSQL and private Storage. The approved implementation uses Vite rather than Next.js. The scholarly retrieval adapters contact Crossref, OpenAlex and Semantic Scholar directly from the server. No fabricated paper or AI fallback is generated.

Users can sign in, upload a real PDF/DOCX, inspect extracted claims, check DOI and bibliographic records, bookmark findings, re-open history, manage preferences and export the full review. The public example is explicitly curated: six illustrative claims reviewed against two genuine published abstracts. Its six database checks include the unsuccessful lookup. All four report formats retain every claim, source, citation and check regardless of the UI filter.

## Read before accepting confidential material

**This installation is in public-paper mode, not certified for confidential production use.** An owner-only API test passed, but direct Supabase tests on two dedicated QA accounts found permissive database and storage provisioning defaults. Adding another permissive owner policy cannot override an existing broader policy. The application therefore requires an explicit public-material declaration and rejects requests for confidential uploads.

Private report contents, source checks, filenames, references, saved-claim text and original file bytes are encrypted with account-specific AES-256-GCM envelopes. Keys live in the authenticated user's private Supabase Auth metadata, not the public schema. Profile settings are private Auth metadata. Files are never publicly linked; the authenticated API decrypts original downloads. This is application-layer encryption, not E2EE. Encrypted data alone is not a substitute for restrictive authorization or protection against deletion.

The database owner must apply `supabase/harden.sql` through the Supabase administration console. It adds *restrictive* policies to override permissive defaults, protects scholarly records, and creates a bookmark uniqueness constraint. It preserves existing data. Run the migration once. Validate again with `node scripts/check-isolation.mjs` using two operator-owned test accounts (`QA_A_EMAIL`, `QA_A_PASSWORD`, `QA_B_EMAIL`, `QA_B_PASSWORD` in the local environment). A failed check cleans up its own non-sensitive fixtures and must block the release. Confirm update/delete isolation, backups, recovery, retention, auth quotas and monitoring as part of the owner's production review. Only after certification may the operator set `RESEARCH_ISOLATION_VERIFIED=true` server-side and redeploy. Never enable this variable to bypass a failed test.

## Authentication and optional provider configuration

Email registration and sign-in use Supabase Auth with a password; no one-time code is requested. The existing Google sign-in option is unchanged. Successful authentication returns to the originating app route, including its query parameters, or to the workspace for a direct login. Frontend Supabase publishable credentials and the Google OAuth proxy are supplied by the platform. Do not expose service credentials or put AI keys in `VITE_*` variables.

Gemini **is not configured in the supplied environment**. The backend has a real, optional `generateContent` adapter for deployment-managed `GEMINI_API_KEY` and `GEMINI_MODEL`. It validates structured responses against actual retrieved abstracts: an invented source or non-verbatim evidence span is rejected. In source-only mode, only a verbatim abstract sentence earns an exact-match verdict. Other statements remain Needs Review with no invented confidence. A 100% text match is not a probability of scientific truth. Optional provider-managed OpenAlex and Semantic Scholar credentials can be supplied only through hosting environment configuration, not through a user-facing key input.

## Processing

### Manuscript visual provenance

PDF rasters, pages with vector artwork, DOCX images, and native chart caches are inspected with the manuscript. Previews, source locations, chart values, cryptographic fingerprints, exact-match evidence, and unresolved checks are saved inside the same encrypted cloud review as the claims. Account owners can reopen them across devices; guest keys remain browser-bound. Older reports require resubmission for visual analysis. Up to 24 visual items are supported per document; oversized inventories are rejected, not silently truncated. Unsupported artwork and decoding failures are disclosed. Source checks use bounded HTTPS requests to an explicit repository allowlist, not arbitrary URLs or a paid reverse-image service. Limited exact comparisons cannot establish first authorship, detect all alterations, or certify the experiment. No Gemini credentials are needed for visual matching. Existing public-paper and infrastructure release restrictions still apply.

The downloadable teaching manuscript now includes an unaltered Matplotlib gallery plot and a vector graph of the actual sample DOI-check counts. Its separate, integrity-pinned public visual audit was computed by extracting those PDF pages and retrieving the referenced gallery file. This artwork is not scientific evidence for the six sample claims. Matplotlib's license accompanies the public sample. All four report formats include visual-check evidence; PDF and DOCX additionally embed the extracted previews.

Guest verification is available without email, registration, or a shared demo account. `api/guest.js` stores encrypted review, original-file, and bookmark envelopes in `research_guest_records`. An independent 256-bit browser capability unlocks only that guest's data; account APIs still require a verified Supabase session. Guest submissions must be non-confidential. Clearing browser storage loses the key. Use the delete action before clearing browser data if the cloud records should be removed. Guest and account histories are separate.

The console lists anonymized verification job IDs and actual aggregate counts, not published papers. The `research_source_directory` table distinguishes the three integrated retrieval services from external discovery resources. Report references include publisher metadata and available original, database, and open-access links; absent metadata is labeled rather than guessed. Final PDF, DOCX, XLSX, and CSV files are prepared before a user-initiated download. Incomplete reviews cannot be submitted as final reports.

PDFs are parsed with unpdf's serverless PDF.js build. DOCX files are checked for size, container structure and expanded archive limits before extraction with Mammoth. Limits: 3 MB per file, 150 PDF pages, 250,000 extracted characters, 120 detected claims and 150 citations. Oversized reviews are rejected with instructions rather than silently truncated. Image-only PDFs require prior OCR. Twenty new reviews per account per day are permitted by the application API.

Serverless workers use persisted checkpoints and expiring compare-and-swap leases. Each batch records all provider outcomes, including throttling, no-match and timeouts. Work continues briefly after the upload response through Vercel `waitUntil`; the review page resumes outstanding batches when reopened. This is a resumable workflow, not an always-on queue guarantee. Before large-scale unattended production workloads, add a durable queue with authenticated worker dispatch, tenant quotas and retry scheduling.

## Architecture

- `src/pages` — landing, authentication, workspace, upload, report, library, preferences, methodology and privacy.
- `src/lib/export.ts` — Unicode PDF, DOCX, multi-sheet XLSX and spreadsheet-safe CSV exports.
- `api/reports.js`, `api/process.js`, `api/bookmarks.js`, `api/profile.js`, `api/library.js` — authenticated resource handlers, plus deliberately public sample/library reads.
- `server/review.js` — extraction, deterministic claim/citation detection and grounded assessment.
- `server/scholar.js` — validated provider metadata, DOI identity matching and provenance-preserving deduplication.
- `server/jobs.js` — checkpointed background processing.
- `server/account-vault.js` — authenticated encryption and account storage.
- `research_reports` — public curated sample, encrypted private review envelopes and job coordinates.
- `research_papers` — real source records for the public sample.
- `research_bookmarks` — owner-linked encrypted bookmarks with cascading review deletion.
- `research_profiles` — reserved empty schema table; sensitive preferences are held in private Auth metadata.
- `research-vault` — private bucket containing encrypted original bytes.

## Validation

`npm run build` checks TypeScript and emits the static application. `node --test scripts/core.test.mjs` verifies actual extraction of PDF and DOCX, DOI detection, exact evidence matching, preservation of mathematical signs, unresolved-claim behavior and encryption integrity. API checks use real Supabase records, not mocked browser data. The source-library search handles partial provider outages explicitly.

## Data accuracy

The landing illustration is an editorial visualization, not a live confidence estimate. The sample citations are Rasch & Born (2013), DOI 10.1152/physrev.00032.2012, and Cepeda et al. (2008), DOI 10.1111/j.1467-9280.2008.02209.x. The downloadable sample manuscript is an educational exercise and is not either author's original article. Verdicts apply to available abstracts and scope, not a comprehensive systematic review.
