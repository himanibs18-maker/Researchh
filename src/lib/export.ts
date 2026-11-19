import {
  VERDICTS,
  type Format,
  type Report,
  type ManuscriptFigure,
} from "./types";
export interface SubmissionDetails {
  submittedBy?: string;
  institution?: string;
  recipient?: string;
  documentPublisher?: string;
}
export interface ExportFile {
  blob: Blob;
  name: string;
}
const reportCode = (r: Report) =>
  "RES-" + r.id.replace(/^g-/, "").toUpperCase();
const displayPublisher = (source: Report["sources"][number]) =>
  source.publisher?.trim() || "Not supplied by the retrieved record";
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const csvCell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
type Line = {
  style: "title" | "heading" | "sub" | "body";
  text: string;
  figure?: ManuscriptFigure;
};
function content(
  r: Report,
  details: SubmissionDetails,
  issued: string,
): Line[] {
  const out: Line[] = [],
    add = (style: Line["style"], text: string) => out.push({ style, text });
  add("title", "Scientific Claim and Citation Verification Report");
  add("heading", r.title);
  add(
    "body",
    `Formal report submission\nReport publisher: Research\nReport reference: ${reportCode(r)}\nIssue date (UTC): ${issued}\nReview created: ${new Date(r.created_at).toISOString()}\nSubmission type: ${r.is_sample ? "Curated educational example" : r.is_guest ? "Guest verification" : "Account verification"}\nSubmitted by: ${details.submittedBy?.trim() || "Not supplied"}\nInstitution: ${details.institution?.trim() || "Not supplied"}\nSubmitted to: ${details.recipient?.trim() || "Not specified"}\nReview status: Complete`,
  );
  add(
    "body",
    `Document: ${r.file_name}\nOriginal document publisher (submitter-supplied): ${details.documentPublisher?.trim() || "Not supplied"}\nMethod: ${r.review_method}\n${r.claims.length} detected claims · ${r.sources.length} unique sources · ${r.checks.length} source checks`,
  );
  add("heading", "1. Executive summary");
  add(
    "body",
    `This submission reviews ${r.claims.length} detected claim(s) against ${r.sources.length} distinct scholarly record(s). It records ${r.checks.length} database checks, including ${r.checks.filter((c) => c.outcome === "Provider unavailable").length} unavailable lookup(s). All findings and unresolved items are included, irrespective of display filters.`,
  );
  add("heading", "2. Objectives and methodology");
  add(
    "body",
    `Objective: establish the identity of cited publications and assess how their available evidence relates to the submitted statements. ${r.is_sample ? "This curated example uses real published abstracts and illustrative statements." : "Statements and citations were detected from the submitted PDF or DOCX; matching uses retrieved scholarly records."} Method recorded for this review: ${r.review_method}. A matching DOI is not evidence of claim support. Publisher names are taken from retrieved metadata, not inferred from a journal or database name.`,
  );
  add(
    "body",
    "Databases actually checked: " +
      ([...new Set(r.checks.map((c) => c.provider))].join(", ") ||
        "None recorded") +
      ". Additional discovery resources in the website directory are not part of this audit unless explicitly listed.",
  );
  add("heading", "3. Findings by classification");
  VERDICTS.forEach((v) =>
    add("body", `${v}: ${r.claims.filter((c) => c.status === v).length}`),
  );
  for (const [title, statuses] of [
    ["Contradicted findings (evidence against the claim)", ["Contradictory"]],
    ["Possibly outdated information", ["Possibly Outdated"]],
    [
      "Unverifiable or insufficiently evidenced claims",
      ["Needs Review", "Unsupported"],
    ],
    ["Partially supported claims", ["Partially Supported"]],
    ["Supported claims", ["Supported"]],
  ] as [string, string[]][]) {
    add("sub", title);
    const claims = r.claims.filter((c) => statuses.includes(c.status));
    if (!claims.length) add("body", "No findings in this category.");
    for (const c of claims) {
      add("sub", `${c.id} · ${c.status}`);
      add("body", c.text);
      add("body", `Assessment: ${c.explanation}`);
      add(
        "body",
        `Method: ${c.method}. Confidence: ${c.confidence === null ? "Not assessed" : c.confidence + "% (" + (c.method.includes("Exact") ? "text match" : "uncalibrated model estimate") + ")"}.`,
      );
      if (c.evidence) add("body", `Evidence excerpt: “${c.evidence}”`);
      add(
        "body",
        c.source_ids.length
          ? "Sources: " +
              c.source_ids
                .map((id) => {
                  const s = r.sources.find((p) => p.id === id);
                  return s
                    ? `[${r.sources.indexOf(s) + 1}] ${s.title} (${s.year || "n.d."}). Publisher: ${displayPublisher(s)}. ${s.url}`
                    : id;
                })
                .join("; ")
          : "Sources: No sufficient source match.",
      );
    }
  }
  add("heading", "4. Conclusion and recommended review");
  const attention = r.claims.filter((c) => c.status !== "Supported");
  add(
    "body",
    !r.claims.length
      ? "No claims were detected. Only the citation checks in this report were performed. No conclusion about claim validity can be drawn."
      : attention.length
        ? `${attention.length} of ${r.claims.length} claims require qualification or additional review. Inspect the evidence for ${attention.map((c) => c.id).join(", ")} before citing these statements. Contradiction is distinct from insufficient evidence; an unavailable record does not establish falsehood.`
        : "No detected claim was flagged for additional review. This is limited to the available abstracts and does not certify the entire document.",
  );
  add("heading", "5. References — complete source listing");
  r.sources.forEach((s, i) => {
    add("sub", `${String(i + 1).padStart(2, "0")}. ${s.title}`);
    add(
      "body",
      `Authors: ${s.authors || "Not supplied"}\nPublication year: ${s.year || "Not supplied"}\nPublication venue: ${s.journal || "Not supplied"}\nPublisher: ${displayPublisher(s)}\nDOI: ${s.doi || "Not supplied"}\nOriginal record: ${s.url}\nIndexed by: ${s.providers.join(", ")}`,
    );
    if (s.publisher_source)
      add("body", `Publisher metadata: ${s.publisher_source}`);
    for (const [k, v] of Object.entries(s.record_links || {}))
      add("body", `${k} record: ${v}`);
    if (s.open_access_url) add("body", `Open access: ${s.open_access_url}`);
    if (s.abstract) add("body", `Available abstract: ${s.abstract}`);
  });
  if (!r.sources.length) add("body", "No sources retrieved.");
  add("heading", "Appendix A. Complete source-check audit");
  r.checks.forEach((c, i) => {
    add("sub", `${i + 1}. ${c.provider} — ${c.outcome}`);
    add(
      "body",
      `Query: ${c.query}\nChecked: ${c.checked_at}\n${c.claim_id ? "Claim: " + c.claim_id + "\n" : ""}Records: ${c.source_ids.join(", ") || "None"}${c.detail ? "\nNote: " + c.detail : ""}`,
    );
  });
  add("heading", "Appendix B. Detected citations");
  r.citations.forEach((c) => add("body", `${c.kind}: ${c.value}`));
  if (!r.citations.length) add("body", "No explicit citations detected.");
  add("heading", "Appendix C. Images, graphs and provenance");
  if (!r.figures?.length)
    add(
      "body",
      r.figure_audit_version
        ? "No supported visual objects were detected in this manuscript."
        : "This older review has no recorded visual inspection.",
    );
  for (const note of r.figure_notes || []) add("body", note);
  for (const f of r.figures || []) {
    out.push({
      style: "sub",
      text: `${f.id} · ${f.kind} · ${f.location}`,
      figure: f,
    });
    add(
      "body",
      `Caption: ${f.caption || "Not supplied"}\n${f.note}\nDeclared source: ${f.declared_source || "None supplied"}`,
    );
    if (f.file_sha256) add("body", `Embedded file SHA-256: ${f.file_sha256}`);
    if (f.pixel_sha256)
      add(
        "body",
        `RGBA pixel SHA-256: ${f.pixel_sha256} (${f.width} × ${f.height})`,
      );
    if (f.same_as)
      add(
        "body",
        `The same fingerprint occurs in ${f.same_as}. Reuse is not evidence of manipulation.`,
      );
    const all = [...(f.previous_checks || []), f.provenance];
    all.forEach((p, i) => {
      add(
        "sub",
        `${i === all.length - 1 ? "Current" : "Previous"} provenance assessment: ${p.status}`,
      );
      add("body", p.explanation);
      if (p.source_input) add("body", "Attribution checked: " + p.source_input);
      if (p.source_url) add("body", "Located source: " + p.source_url);
      if (p.reference_url) add("body", "Compared asset: " + p.reference_url);
      if (p.reference_hash)
        add("body", "Reference fingerprint: " + p.reference_hash);
      if (p.credit) add("body", "Source credit: " + p.credit);
      if (p.license) add("body", "Repository license: " + p.license);
      if (p.checked_at) add("body", "Checked at: " + p.checked_at);
      p.checks.forEach((c) =>
        add("body", `${c.service}: ${c.outcome}${c.url ? " " + c.url : ""}`),
      );
    });
    for (const s of f.chart?.series || [])
      add(
        "body",
        `${s.name} (cached chart values): ${s.values.map((v, i) => `${s.categories[i] ?? i + 1}: ${v ?? "missing"}`).join("; ")}`,
      );
  }
  add("heading", "Appendix D. Limitations and declaration");
  add(
    "body",
    "A DOI match confirms a record, not the truth of a claim. Retrieval is limited to available metadata and abstracts. No match is not proof of falsehood. Publication age alone does not establish that a claim is outdated. Confidence is not a calibrated probability of scientific truth. This report supports, but does not replace, expert review.",
  );
  add(
    "body",
    "Declaration: this is a system-generated evidence review, not a peer-review certificate or an endorsement by any cited publisher. No human approval or signature is implied.",
  );
  add("sub", "End of formal submission");
  return out;
}
export async function exportReport(
  r: Report,
  format: Format,
  details: SubmissionDetails = {},
): Promise<ExportFile> {
  if (r.status !== "complete" || r.processed < r.task_count)
    throw new Error(
      "The final report will be available after all source checks finish.",
    );
  const name =
    (r.title.replace(/[^\p{L}\d -]/gu, "").trim() || "Research") +
    " - evidence review";
  const issued = new Date().toISOString();
  const lines = content(r, details, issued);
  const images = new Map<string, Uint8Array>();
  if (format === "PDF" || format === "DOCX")
    for (const f of r.figures || []) {
      if (/^data:image\/jpeg;base64,/.test(f.preview))
        images.set(
          f.id,
          Uint8Array.from(atob(f.preview.split(",")[1]), (c) =>
            c.charCodeAt(0),
          ),
        );
      else if (
        r.is_sample &&
        /^\/samples\/figures\/F\d{3}\.jpg$/.test(f.preview)
      ) {
        const res = await fetch(f.preview);
        if (!res.ok)
          throw new Error(
            "Figure previews are temporarily unavailable. Please retry the export.",
          );
        images.set(f.id, new Uint8Array(await res.arrayBuffer()));
      }
    }
  if (format === "PDF") {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      putOnlyUsedFonts: true,
      compress: true,
    });
    await Promise.all(
      (["normal", "bold"] as const).map(async (style) => {
        const file =
          style === "normal" ? "DejaVuSans.ttf" : "DejaVuSans-Bold.ttf";
        const response = await fetch("/fonts/report/" + file);
        if (!response.ok)
          throw new Error(
            "Report fonts are unavailable. Please retry the export.",
          );
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        doc.addFileToVFS(file, btoa(binary));
        doc.addFont(file, "ResearchSans", style);
      }),
    );
    doc.setProperties({
      title: r.title,
      subject: "Complete scientific claim and citation review",
      author: "Research",
    });
    doc.setFont("ResearchSans", "normal");
    // Dedicated submission cover, separate from the numbered findings.
    doc.setFillColor(244, 240, 248);
    doc.rect(0, 0, 210, 297, "F");
    doc.setFillColor(120, 84, 168);
    doc.rect(20, 27, 20, 1.1, "F");
    doc.setTextColor(100, 76, 130);
    doc.setFontSize(9);
    doc.text("RESEARCH  /  FORMAL SUBMISSION", 20, 37);
    doc.setTextColor(39, 33, 47);
    doc.setFont("ResearchSans", "bold");
    doc.setFontSize(28);
    doc.text(
      ["Scientific Claim and", "Citation Verification", "Report"],
      20,
      68,
      { lineHeightFactor: 1.22 },
    );
    doc.setFontSize(16);
    doc.setFont("ResearchSans", "normal");
    const coverTitle = doc.splitTextToSize(r.title, 170);
    doc.text(coverTitle, 20, 123);
    let coverY = Math.max(154, 128 + coverTitle.length * 7);
    doc.setFontSize(10);
    const coverFields = [
      ["Report publisher", "Research"],
      ["Submitted by", details.submittedBy?.trim() || "Not supplied"],
      ["Institution", details.institution?.trim() || "Not supplied"],
      ["Submitted to", details.recipient?.trim() || "Not specified"],
      ["Issue date", issued.slice(0, 10) + " (UTC)"],
      ["Report reference", reportCode(r)],
    ];
    for (const [label, value] of coverFields) {
      doc.setTextColor(101, 91, 113);
      doc.setFontSize(8);
      doc.text(label.toUpperCase(), 20, coverY);
      doc.setTextColor(40, 35, 46);
      doc.setFontSize(10);
      const wrap = doc.splitTextToSize(value, 131);
      doc.text(wrap, 59, coverY);
      coverY += Math.max(10, wrap.length * 4.8 + 4);
    }
    doc.addPage();
    let y = 26;
    const page = () => {
      doc.setDrawColor(220, 215, 231);
      doc.line(18, 17, 192, 17);
      doc.setTextColor(112, 92, 148);
      doc.setFontSize(8);
      doc.text("RESEARCH  /  EVIDENCE REVIEW", 18, 13);
      doc.setFontSize(8);
    };
    page();
    for (const l of lines.slice(3)) {
      const size =
          l.style === "title"
            ? 23
            : l.style === "heading"
              ? 16
              : l.style === "sub"
                ? 11
                : 9.5,
        lead = size * 0.47;
      const pad = l.style === "heading" ? 6 : l.style === "sub" ? 3 : 1.5;
      if (
        y + pad + lead + (l.style === "heading" || l.style === "sub" ? 12 : 0) >
        273
      ) {
        doc.addPage();
        page();
        y = 26;
      }
      y += pad;
      doc.setFont("ResearchSans", l.style === "body" ? "normal" : "bold");
      doc.setFontSize(size);
      doc.setTextColor(
        ...((l.style === "heading" ? [104, 74, 150] : [38, 35, 43]) as [
          number,
          number,
          number,
        ]),
      );
      const wrapped = doc.splitTextToSize(l.text, 174);
      for (const text of wrapped) {
        if (y + lead > 276) {
          doc.addPage();
          page();
          y = 26;
          doc.setFontSize(size);
          doc.setTextColor(38, 35, 43);
        }
        doc.text(text, 18, y);
        const url = l.text.match(/https:\/\/[^\s]+/)?.[0];
        if (url)
          doc.link(
            18,
            y - lead * 0.85,
            Math.min(174, doc.getTextWidth(text)),
            lead,
            { url },
          );
        y += lead;
      }
      const illustration = l.figure && images.get(l.figure.id);
      if (illustration) {
        const p = doc.getImageProperties(illustration),
          scale = Math.min(158 / p.width, 82 / p.height),
          w = p.width * scale,
          h = p.height * scale;
        if (y + h + 6 > 273) {
          doc.addPage();
          page();
          y = 26;
        }
        doc.addImage(illustration, "JPEG", 18, y + 1, w, h);
        y += h + 6;
      }
    }
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont("ResearchSans", "normal");
      doc.setFontSize(8);
      doc.setTextColor(105, 93, 118);
      doc.setDrawColor(219, 212, 227);
      doc.line(18, 280, 192, 280);
      doc.text("RESEARCH  /  SCIENTIFIC VERIFICATION", 18, 287);
      doc.text(`${i} / ${pages}`, 192, 287, { align: "right" });
    }
    return { blob: doc.output("blob"), name: name + ".pdf" };
  }
  if (format === "DOCX") {
    const {
      Document,
      Paragraph,
      HeadingLevel,
      Packer,
      TextRun,
      Header,
      Footer,
      PageNumber,
      AlignmentType,
      ExternalHyperlink,
      ImageRun,
    } = await import("docx");
    const doc = new Document({
      creator: "Research",
      title: r.title,
      sections: [
        {
          children: lines.map(
            (l) =>
              new Paragraph({
                heading:
                  l.style === "title"
                    ? HeadingLevel.TITLE
                    : l.style === "heading"
                      ? HeadingLevel.HEADING_1
                      : l.style === "sub"
                        ? HeadingLevel.HEADING_2
                        : undefined,
                pageBreakBefore: l.text === "1. Executive summary",
                keepNext: l.style !== "body",
                spacing: { after: l.style === "body" ? 100 : 160 },
                children: [
                  ...l.text.split("\n").flatMap((t, i) => [
                    ...(i ? [new TextRun({ break: 1 })] : []),
                    ...t
                      .split(/(https:\/\/[^\s]+)/g)
                      .filter(Boolean)
                      .map((v) =>
                        v.startsWith("https://")
                          ? new ExternalHyperlink({
                              link: v,
                              children: [
                                new TextRun({ text: v, style: "Hyperlink" }),
                              ],
                            })
                          : new TextRun(v),
                      ),
                  ]),
                  ...(l.figure && images.has(l.figure.id)
                    ? [
                        new TextRun({ break: 1 }),
                        new ImageRun({
                          type: "jpg",
                          data: images.get(l.figure.id)!,
                          transformation: {
                            width: Math.round(
                              Math.min(
                                480,
                                (275 * (l.figure.width || 700)) /
                                  (l.figure.height || 320),
                              ),
                            ),
                            height: Math.round(
                              Math.min(
                                275,
                                (480 * (l.figure.height || 320)) /
                                  (l.figure.width || 700),
                              ),
                            ),
                          },
                        }),
                      ]
                    : []),
                ],
              }),
          ),
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  text: "Research  /  Scientific verification",
                  style: "Header",
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun("Research  ·  Page "),
                    new TextRun({ children: [PageNumber.CURRENT] }),
                    new TextRun(" / "),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                  ],
                }),
              ],
            }),
          },
        },
      ],
    });
    return { blob: await Packer.toBlob(doc), name: name + ".docx" };
  }
  const claimRows = r.claims.map((c) => ({
    ID: c.id,
    Claim: c.text,
    Verdict: c.status,
    Confidence: c.confidence ?? "Not assessed",
    Method: c.method,
    Assessment: c.explanation,
    Evidence: c.evidence,
    Sources: c.source_ids.join("; "),
  }));
  const sourceRows = r.sources.map((s) => ({
      ID: s.id,
      Title: s.title,
      Authors: s.authors,
      Year: s.year,
      Journal: s.journal,
      Publisher: displayPublisher(s),
      "Publisher metadata": s.publisher_source || "",
      "Open access": s.open_access_url || "",
      "Database links": Object.entries(s.record_links || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join("; "),
      DOI: s.doi,
      URL: s.url,
      Abstract: s.abstract,
      Databases: s.providers.join("; "),
    })),
    checkRows = r.checks.map((c) => ({
      Database: c.provider,
      Query: c.query,
      Outcome: c.outcome,
      Detail: c.detail || "",
      Claim: c.claim_id || "",
      Sources: c.source_ids.join("; "),
      Checked: c.checked_at,
    }));
  if (format === "Excel") {
    const x = await import("xlsx");
    const wb = x.utils.book_new();
    for (const [n, rows] of Object.entries({
      Summary: [
        {
          Document: r.title,
          Method: r.review_method,
          Status: r.status,
          Created: r.created_at,
          "Report publisher": "Research",
          "Report reference": reportCode(r),
          "Issue date": issued,
          "Submitted by": details.submittedBy || "Not supplied",
          Institution: details.institution || "Not supplied",
          "Submitted to": details.recipient || "Not specified",
        },
        ...VERDICTS.map((v) => ({
          Verdict: v,
          Count: r.claims.filter((c) => c.status === v).length,
        })),
      ],
      Claims: claimRows,
      Sources: sourceRows,
      "Source checks": checkRows,
      Citations: r.citations,
      "Figure provenance": (r.figures || []).map((f) => ({
        Figure: f.id,
        Location: f.location,
        Type: f.kind,
        Caption: f.caption,
        Status: f.provenance.status,
        Explanation: f.provenance.explanation,
        "Declared source": f.declared_source,
        "Located source": f.provenance.source_url || "",
        "Compared asset": f.provenance.reference_url || "",
        "File SHA-256": f.file_sha256,
        "Pixel SHA-256": f.pixel_sha256,
        "Source fingerprint": f.provenance.reference_hash || "",
        Checked: f.provenance.checked_at || "",
      })),
      "Chart values": (r.figures || []).flatMap((f) =>
        (f.chart?.series || []).flatMap((s) =>
          s.values.map((v, i) => ({
            Figure: f.id,
            Series: s.name,
            Category: s.categories[i] ?? i + 1,
            Value: v ?? "Missing",
          })),
        ),
      ),
      "Formal submission": lines.map((l) => ({
        Section: l.style,
        Text: l.text,
      })),
    })) {
      x.utils.book_append_sheet(wb, x.utils.json_to_sheet(rows), n);
    }
    return {
      blob: new Blob([x.write(wb, { type: "array", bookType: "xlsx" })], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      name: name + ".xlsx",
    };
  }
  const csv = [
    "Section,Content",
    ...lines.map((l) => [csvCell(l.style), csvCell(l.text)].join(",")),
  ].join("\r\n");
  return {
    blob: new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    name: name + ".csv",
  };
}
