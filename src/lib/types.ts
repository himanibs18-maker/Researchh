export const VERDICTS = [
  "Supported",
  "Partially Supported",
  "Unsupported",
  "Contradictory",
  "Possibly Outdated",
  "Needs Review",
] as const;
export type Verdict = (typeof VERDICTS)[number];
export type Format = "PDF" | "DOCX" | "Excel" | "CSV";
export interface Paper {
  id: string;
  doi: string;
  title: string;
  authors: string;
  year: number | null;
  journal: string;
  publisher?: string;
  publisher_source?: string;
  record_links?: Record<string, string>;
  open_access_url?: string;
  abstract: string;
  url: string;
  providers: string[];
}
export interface Claim {
  id: string;
  text: string;
  status: Verdict;
  confidence: number | null;
  explanation: string;
  evidence: string;
  source_ids: string[];
  method: string;
}
export interface SourceCheck {
  provider: string;
  query: string;
  outcome: string;
  detail?: string;
  source_ids: string[];
  checked_at: string;
  claim_id?: string;
  kind?: string;
}
export interface FigureProvenance {
  status: string;
  explanation: string;
  source_input?: string;
  source_url?: string;
  source_title?: string;
  reference_url?: string;
  reference_hash?: string;
  credit?: string;
  license?: string;
  checked_at: string | null;
  checks: { service: string; outcome: string; url?: string }[];
}
export interface ManuscriptFigure {
  id: string;
  kind: "Image" | "Native chart" | "Vector page";
  caption: string;
  location: string;
  preview: string;
  note: string;
  declared_source: string;
  width: number;
  height: number;
  file_sha256: string;
  pixel_sha256: string;
  same_as?: string;
  chart?: {
    type: string;
    title: string;
    series: { name: string; categories: string[]; values: (number | null)[] }[];
  };
  provenance: FigureProvenance;
  previous_checks?: FigureProvenance[];
}
export interface Report {
  id: string;
  title: string;
  file_name: string;
  format: string;
  size_bytes: number;
  word_count: number;
  status: string;
  claims: Claim[];
  sources: Paper[];
  checks: SourceCheck[];
  citations: { kind: string; value: string }[];
  created_at: string;
  updated_at: string;
  review_method: string;
  is_sample: boolean;
  is_guest?: boolean;
  figures?: ManuscriptFigure[];
  figure_notes?: string[];
  figure_audit_version?: number;
  processed: number;
  task_count: number;
}
export interface Bookmark {
  id: string;
  report_id: string;
  claim_id: string;
  claim_text: string;
  status: Verdict;
  report_title: string;
}
export type Theme = "light" | "dark" | "system";
export interface Profile {
  display_name: string;
  email: string;
  institution: string;
  theme: Theme;
  report_format: Format;
  ai_available: boolean;
  private_uploads_enabled: boolean;
}
export const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
