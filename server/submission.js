import { fail } from "./http.js";
import { extractDocument, detect } from "./review.js";
import { extractFigures } from "./figures.js";

// Account and guest submissions must pass the same file and evidence checks.
export async function parseSubmission(body, publicOnly = true) {
  if (body?.consent !== true)
    throw fail(400, "Confirm permission before processing your document.");
  if (publicOnly && body.public_material !== true)
    throw fail(
      403,
      "Only public, non-confidential documents may be submitted in this workspace.",
    );
  if (
    typeof body.file_name !== "string" ||
    typeof body.file_base64 !== "string"
  )
    throw fail(400, "An original PDF or DOCX document is required.");
  if (body.file_base64.length > 4194304)
    throw fail(413, "Choose a file of 3 MB or less.");
  const format = body.file_name.toLowerCase().split(".").pop();
  if (!["pdf", "docx"].includes(format))
    throw fail(415, "Only PDF and DOCX files are supported.");
  const bytes = Buffer.from(body.file_base64, "base64");
  if (bytes.length < 8 || bytes.length > 3145728)
    throw fail(422, "Choose a nonempty document up to 3 MB.");
  const text = await extractDocument(bytes, format),
    detected = detect(text);
  const visual = await extractFigures(bytes, format);
  Object.assign(detected, visual);
  detected.queue.push(
    ...visual.figures
      .filter((f) => f.declared_source)
      .map((f) => ({
        type: "figure",
        figure_id: f.id,
        value: f.declared_source,
      })),
  );
  if (
    !detected.claims.length &&
    !detected.citations.length &&
    !visual.figures.length
  )
    throw fail(
      422,
      "No scientific statements, references, images or graphs were detected in the manuscript.",
    );
  const name = body.file_name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 180);
  return { bytes, name, format, text, detected };
}
