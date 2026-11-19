# Research

An evidence-first research workspace for scientific claim and citation review.

**Stack:** React, TypeScript, Tailwind CSS and Vite; Vercel serverless functions; Supabase Authentication, PostgreSQL and Storage. Real scholarly retrieval integrations for Crossref, OpenAlex and Semantic Scholar; optional server-side Gemini evidence assessment.

## Build and test

```sh
npm install
npm run build
node --test scripts/core.test.mjs
```

The app includes a responsive landing page, public source library, a genuinely sourced sample review, document extraction, authenticated workspaces, resumable verification, encrypted saved claims, theme and profile preferences, and complete PDF/DOCX/XLSX/CSV exports. A PDF export includes separate contradicted, potentially outdated, and insufficient-evidence sections, followed by the full source-check audit.

**Deployment status:** public, non-confidential research mode. Gemini is not configured. Read **DEPLOYMENT.md** for the verified workflows, security findings, release gates, OAuth/email configuration and production requirements. Do not treat this deployment as certified for confidential manuscripts until restrictive Supabase policies and isolation tests pass.
