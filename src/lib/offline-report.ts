import type { Report } from "./types";

export function offlineReport(fileName = "Uploaded research document.pdf"): Report {
  const checkedAt = new Date().toISOString();
  return {
    id: "offline-demo",
    title: "Offline demonstration review",
    file_name: fileName,
    format: fileName.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF",
    size_bytes: 0,
    word_count: 0,
    status: "complete",
    review_method: "Offline demonstration - illustrative findings only",
    is_sample: true,
    created_at: checkedAt,
    updated_at: checkedAt,
    processed: 2,
    task_count: 2,
    claims: [
      {
        id: "C001",
        text: "Sleep supports memory consolidation.",
        status: "Partially Supported",
        confidence: null,
        explanation: "This illustrative offline result shows the review format. A real verdict requires the connected scholarly-source service.",
        evidence: "Sample evidence is displayed for presentation purposes only while the local service is offline.",
        source_ids: ["P001"],
        method: "Offline demonstration",
      },
      {
        id: "C002",
        text: "The exact strength of a scientific effect must be supported by the cited source.",
        status: "Needs Review",
        confidence: null,
        explanation: "No live database retrieval was performed. This claim remains open for human review.",
        evidence: "No live evidence retrieved in offline mode.",
        source_ids: [],
        method: "Offline demonstration",
      },
    ],
    sources: [
      {
        id: "P001",
        doi: "10.1152/physrev.00032.2012",
        title: "About Sleep's Role in Memory",
        authors: "Rasch, B.; Born, J.",
        year: 2013,
        journal: "Physiological Reviews",
        publisher: "American Physiological Society",
        abstract: "Illustrative source record used only for the offline demonstration.",
        url: "https://doi.org/10.1152/physrev.00032.2012",
        providers: ["Offline demo"],
      },
    ],
    checks: [
      {
        provider: "Offline demonstration",
        query: "Document claims and citations",
        outcome: "Live retrieval unavailable - human review required",
        detail: "Connect Supabase and the research service for live verification.",
        source_ids: ["P001"],
        checked_at: checkedAt,
      },
    ],
    citations: [{ kind: "Sample reference", value: "Rasch & Born (2013)" }],
    figures: [],
  };
}
