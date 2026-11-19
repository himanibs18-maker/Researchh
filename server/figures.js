import { createHash } from "node:crypto";
import path from "node:path";
import Zip from "adm-zip";
import { DOMParser } from "@xmldom/xmldom";
import { imageSize } from "image-size";
import { dois } from "./scholar.js";
import { fail } from "./http.js";

const MAX_FIGURES = 24,
  MAX_PIXELS = 12_000_000;
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const toArray = (list) => Array.from(list || []);
export const elements = (node, tag) =>
  toArray(node?.getElementsByTagNameNS("*", tag));
export const plain = (node) =>
  String(node?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
export function xml(text) {
  if (
    !text ||
    text.length > 10_000_000 ||
    /<!ENTITY|<!DOCTYPE[^>]*\[/i.test(text)
  )
    return null;
  // Discard external DTD declarations; never resolve external entities.
  text = text.replace(/<!DOCTYPE\s+[^>]+>/gi, "");
  return new DOMParser().parseFromString(text, "application/xml");
}
const prefix = /^\s*(?:fig(?:ure)?\.?|graph|chart|plate)\s*(?:S?\d+|[IVX]+)\b/i;
const credit =
  /^\s*(?:sources?\s*[:.]|credit\s*:|reproduced from|adapted from|image courtesy|https?:\/\/|doi\s*:)/i;
export function declaredSource(caption) {
  const links = String(caption || "").match(/https?:\/\/[^\s<>"\]]+/g) || [];
  const url = links
    .map((s) => s.replace(/[.,;)]+$/, ""))
    .find((s) => !s.startsWith("https://doi.org/"));
  return url || dois(caption || "")[0] || "";
}
export function pixelHash(width, height, pixels) {
  return createHash("sha256")
    .update(`RGBA:${width}x${height}:`)
    .update(pixels)
    .digest("hex");
}
const canvasModule = () => import("@napi-rs/canvas");
async function thumbnail(image, w, h) {
  const { createCanvas } = await canvasModule();
  let scale = Math.min(1, 760 / w, 550 / h);
  for (let i = 0; i < 5; i++) {
    const c = createCanvas(
        Math.max(1, Math.round(w * scale)),
        Math.max(1, Math.round(h * scale)),
      ),
      ctx = c.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(image, 0, 0, c.width, c.height);
    const b = await c.encode("jpeg", i ? 72 : 85);
    if (b.length <= 48000 || i === 4)
      return "data:image/jpeg;base64," + b.toString("base64");
    scale *= 0.72;
  }
  return "";
}
export async function rasterInfo(bytes, preview = false) {
  const dim = imageSize(bytes);
  if (
    !["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(dim.type) ||
    !dim.width ||
    !dim.height ||
    dim.width * dim.height > MAX_PIXELS
  )
    throw new Error("Raster format or dimensions exceed the supported limit.");
  const { createCanvas, loadImage } = await canvasModule(),
    im = await loadImage(Buffer.from(bytes)),
    c = createCanvas(im.width, im.height),
    ctx = c.getContext("2d");
  ctx.drawImage(im, 0, 0);
  return {
    width: im.width,
    height: im.height,
    pixel_sha256: pixelHash(
      im.width,
      im.height,
      ctx.getImageData(0, 0, im.width, im.height).data,
    ),
    file_sha256: hash(bytes),
    ...(preview ? { preview: await thumbnail(im, im.width, im.height) } : {}),
  };
}
function figure(items, props) {
  if (items.length >= MAX_FIGURES)
    throw fail(
      422,
      `This manuscript contains more than ${MAX_FIGURES} visual items. Upload a shorter section so no figures are omitted.`,
    );
  const caption = (props.caption || "").slice(0, 1600),
    declared = declaredSource(caption);
  const f = {
    id: `F${String(items.length + 1).padStart(3, "0")}`,
    caption,
    location: "",
    kind: "Image",
    preview: "",
    file_sha256: "",
    pixel_sha256: "",
    width: 0,
    height: 0,
    note: "",
    ...props,
    declared_source: declared,
    provenance: {
      status: declared ? "Pending source check" : "Origin unresolved",
      explanation: declared
        ? "The figure’s attribution will be checked against its stated source."
        : "No source identifier was found in the figure caption. A manuscript citation elsewhere is not evidence of this figure’s origin.",
      checks: [],
      checked_at: null,
    },
  };
  items.push(f);
  return f;
}
function relations(zip) {
  const document = xml(zip.readAsText("word/_rels/document.xml.rels"));
  return new Map(
    elements(document, "Relationship").map((r) => [
      r.getAttribute("Id"),
      {
        target: r.getAttribute("Target") || "",
        external: r.getAttribute("TargetMode") === "External",
      },
    ]),
  );
}
const textOf = (p) => elements(p, "t").map(plain).join("").trim();
function contextualCaption(paras, i, rels, alt) {
  const choices = [paras[i], paras[i + 1], paras[i - 1]].filter(Boolean),
    cap =
      choices.find(
        (p) =>
          prefix.test(textOf(p)) ||
          /caption/i.test(
            elements(p, "pStyle")[0]?.getAttribute("w:val") || "",
          ),
      ) || choices.find((p) => credit.test(textOf(p)));
  const parts = [alt, cap && textOf(cap)].filter(Boolean);
  if (cap) {
    const next = paras[paras.indexOf(cap) + 1];
    if (next && credit.test(textOf(next))) parts.push(textOf(next));
    for (const l of [
      ...elements(cap, "hyperlink"),
      ...elements(next && credit.test(textOf(next)) ? next : null, "hyperlink"),
    ]) {
      const rel = rels.get(l.getAttribute("r:id"));
      if (rel?.external && /^https:\/\//.test(rel.target))
        parts.push(rel.target);
    }
  }
  return [...new Set(parts)].join(" ").slice(0, 1600);
}
function cacheValues(n) {
  if (!n) return [];
  const points = elements(n, "pt").map((p) => [
    Number(p.getAttribute("idx")),
    plain(elements(p, "v")[0]),
  ]);
  if (points.some(([i]) => !Number.isInteger(i) || i < 0 || i > 2000))
    return [];
  const a = [];
  points.forEach(([i, v]) => (a[i] = v));
  return a;
}
function chartInfo(data) {
  const root = xml(data),
    plot = elements(root, "plotArea")[0];
  if (!plot) return null;
  const chart = toArray(plot.childNodes).find(
    (n) => n.nodeType === 1 && /Chart$/.test(n.localName || ""),
  );
  if (!chart) return null;
  const ser = elements(chart, "ser");
  if (ser.length > 12) return null;
  const series = ser.map((s, i) => {
    const cache = cacheValues(elements(s, "val")[0] || elements(s, "yVal")[0]);
    const nums = cache.map((x) =>
      x !== "" && x != null && Number.isFinite(Number(x)) ? Number(x) : null,
    );
    const cat = cacheValues(elements(s, "cat")[0] || elements(s, "xVal")[0]);
    const name =
      plain(elements(elements(s, "tx")[0], "v")[0]) || `Series ${i + 1}`;
    return { name, values: nums, categories: cat };
  });
  if (
    !series.length ||
    series.some((s) => s.values.length > 160) ||
    !series.some((s) => s.values.some((v) => v !== null))
  )
    return null;
  return {
    type: chart.localName.replace(/Chart$/, ""),
    series,
    title: elements(elements(root, "title")[0], "t").map(plain).join(" "),
  };
}
async function chartThumb(chart) {
  const { createCanvas } = await canvasModule(),
    c = createCanvas(700, 320),
    ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 700, 320);
  const all = chart.series.flatMap((s) => s.values).filter(Number.isFinite),
    min = Math.min(0, ...all),
    max = Math.max(0, ...all),
    range = max - min || 1;
  const x = (i, n) => 65 + (n > 1 ? i / (n - 1) : 0.5) * 580,
    y = (v) => 249 - ((v - min) / range) * 178;
  ctx.fillStyle = "#504759";
  ctx.font = "16px sans-serif";
  ctx.fillText((chart.title || "Embedded chart values").slice(0, 70), 18, 28);
  ctx.font = "11px sans-serif";
  ctx.fillText("Data preview · category order from the document", 18, 47);
  ctx.strokeStyle = "#c9c2cf";
  ctx.beginPath();
  ctx.moveTo(56, 61);
  ctx.lineTo(56, 252);
  ctx.lineTo(663, 252);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const v = min + ((max - min) * i) / 3;
    ctx.fillStyle = "#655d6d";
    ctx.fillText(Number(v.toPrecision(3)).toString(), 8, y(v) + 3);
    ctx.strokeStyle = "#e8e5eb";
    ctx.beginPath();
    ctx.moveTo(56, y(v));
    ctx.lineTo(662, y(v));
    ctx.stroke();
  }
  const colors = ["#7956a6", "#498776", "#ae7947", "#6482ac"];
  chart.series.forEach((s, si) => {
    ctx.fillStyle = ctx.strokeStyle = colors[si % colors.length];
    ctx.lineWidth = 1.6;
    let prev = null;
    s.values.forEach((v, i) => {
      if (!Number.isFinite(v)) {
        prev = null;
        return;
      }
      const px = x(i, s.values.length),
        py = y(v);
      if (chart.type === "bar") {
        const step = 480 / Math.max(1, s.values.length),
          width = Math.min(28, (step * 0.8) / chart.series.length);
        ctx.fillRect(
          px + (si - (chart.series.length - 1) / 2) * width - width / 2,
          Math.min(py, y(0)),
          width,
          Math.max(1, Math.abs(y(0) - py)),
        );
        return;
      }
      if (prev && chart.type === "line") {
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, 2 * Math.PI);
      ctx.fill();
      prev = [px, py];
    });
    if (si < 4) ctx.fillText(s.name.slice(0, 19), 18 + si * 165, 305);
  });
  ctx.fillStyle = "#655d6d";
  const cats = chart.series[0].categories;
  for (const i of [
    ...new Set([0, Math.floor((cats.length - 1) / 2), cats.length - 1]),
  ])
    if (i >= 0 && cats[i])
      ctx.fillText(
        cats[i].slice(0, 23),
        Math.min(605, Math.max(22, x(i, cats.length) - 15)),
        273,
      );
  return thumbnail(c, c.width, c.height);
}
async function wordFigures(buffer, items, notes) {
  const zip = new Zip(buffer),
    rels = relations(zip),
    doc = xml(zip.readAsText("word/document.xml")),
    paras = elements(doc, "p");
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    for (const tag of ["blip", "imagedata", "chart"])
      for (const ref of elements(p, tag)) {
        const rid =
            ref.getAttribute("r:embed") ||
            ref.getAttribute("r:id") ||
            ref.getAttribute("r:link"),
          r = rels.get(rid);
        if (!r) continue;
        const alt = elements(p, "docPr")
          .map((n) => n.getAttribute("descr") || n.getAttribute("title"))
          .filter(Boolean)
          .join(" ");
        const f = figure(items, {
          kind: tag === "chart" ? "Native chart" : "Image",
          location: `Paragraph ${i + 1}`,
          caption: contextualCaption(paras, i, rels, alt),
        });
        if (r.external) {
          f.note =
            "Externally linked visual, not embedded. No remote content was loaded into the manuscript preview.";
          continue;
        }
        const part = path.posix.resolve("/word", r.target).slice(1),
          entry = zip.getEntry(part);
        if (
          !entry ||
          !part.startsWith("word/") ||
          entry.header.size > 8_000_000
        ) {
          f.note =
            "The linked document part is missing or exceeds the safe preview limit.";
          continue;
        }
        const bytes = entry.getData();
        f.part = part;
        f.file_sha256 = hash(bytes);
        if (tag === "chart") {
          const chart = chartInfo(bytes.toString());
          if (chart) {
            f.chart = chart;
            f.preview = await chartThumb(chart);
            f.note =
              "Data preview reconstructed from the embedded chart cache. Inspect the manuscript for its original layout, axes and styling.";
          } else
            f.note =
              "A native chart was detected, but its cached series are unavailable or too large to render safely.";
        } else {
          try {
            Object.assign(f, await rasterInfo(bytes, true));
          } catch {
            f.note =
              "This embedded format cannot be safely rasterized. The original part fingerprint is retained.";
          }
        }
      }
  }
  if (!doc) notes.push("The DOCX drawing structure could not be read.");
}
function pdfLines(items) {
  const groups = new Map();
  for (const t of items) {
    if (!t.str || !t.transform) continue;
    const y = Math.round(t.transform[5]);
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y).push({ x: t.transform[4], s: t.str });
  }
  return [...groups]
    .sort((a, b) => b[0] - a[0])
    .map(([y, t]) => ({
      y,
      text: t
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join(" ")
        .trim(),
    }));
}
async function pdfFigures(buffer, items, notes) {
  const {
    getDocumentProxy,
    extractImages,
    getResolvedPDFJS,
    renderPageAsImage,
  } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer), {
    maxImageSize: MAX_PIXELS,
    isEvalSupported: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    useSystemFonts: false,
  });
  const { OPS } = await getResolvedPDFJS();
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      try {
        const lines = pdfLines((await page.getTextContent()).items),
          captions = [];
        for (let i = 0; i < lines.length; i++)
          if (prefix.test(lines[i].text)) {
            let j = i + 1,
              t = lines[i].text;
            while (
              j < Math.min(i + 5, lines.length) &&
              !prefix.test(lines[j].text) &&
              lines[j - 1].y - lines[j].y < 20 &&
              (credit.test(lines[j].text) || !/[.!?]$/.test(t))
            ) {
              t += " " + lines[j++].text;
            }
            captions.push({ y: lines[i].y, text: t.slice(0, 1600) });
          }
        const ops = await page.getOperatorList(),
          images = await extractImages(pdf, n);
        const used = new Set();
        for (const img of images) {
          const nearest = captions
            .map((c) => ({
              c,
              d: Math.min(
                Math.abs(c.y - img.bounds.y),
                Math.abs(c.y - (img.bounds.y + img.bounds.height)),
              ),
            }))
            .filter((x) => x.d < 85)
            .sort((a, b) => a.d - b.d)[0]?.c;
          if (nearest) used.add(nearest);
          const f = figure(items, {
            location: `Page ${n}`,
            caption: nearest?.text || "",
            width: img.width,
            height: img.height,
            pixel_sha256: pixelHash(img.width, img.height, img.data),
            note: "Extracted raster image. The fingerprint covers decoded RGBA pixels, not the complete PDF.",
          });
          const { createCanvas, ImageData } = await canvasModule(),
            c = createCanvas(img.width, img.height);
          c.getContext("2d").putImageData(
            new ImageData(
              new Uint8ClampedArray(img.data),
              img.width,
              img.height,
            ),
            0,
            0,
          );
          f.preview = await thumbnail(c, c.width, c.height);
        }
        const vectors = ops.fnArray.filter(
          (o) => o === OPS.constructPath,
        ).length;
        const remaining = captions.filter((c) => !used.has(c));
        if ((remaining.length && vectors) || (!images.length && vectors >= 3)) {
          const f = figure(items, {
            kind: "Vector page",
            location: `Page ${n}`,
            caption: remaining.map((c) => c.text).join(" "),
            note: "Original page rendering, including vector artwork and text. The page is not a separately embedded image; a visual reference match requires human review.",
          });
          try {
            const b = await renderPageAsImage(pdf, n, {
              canvasImport: canvasModule,
              width: 830,
              format: "jpeg",
              quality: 0.8,
            });
            const { loadImage } = await canvasModule(),
              im = await loadImage(Buffer.from(b));
            f.preview = await thumbnail(im, im.width, im.height);
            f.width = im.width;
            f.height = im.height;
          } catch {
            f.note +=
              " The renderer could not produce a preview; consult the original file.";
          }
        }
      } catch (e) {
        if (e.status) throw e;
        notes.push(
          `Page ${n}: one or more visual objects could not be decoded.`,
        );
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await pdf.cleanup?.();
  }
}
export async function extractFigures(bytes, format) {
  const items = [],
    notes = [];
  try {
    if (format === "pdf") await pdfFigures(bytes, items, notes);
    else await wordFigures(bytes, items, notes);
  } catch (e) {
    if (e.status) throw e;
    notes.push(
      "The visual structure could not be fully decoded. Inspect the original manuscript.",
    );
  }
  const seen = new Map();
  for (const f of items) {
    const fingerprint = f.pixel_sha256 || f.file_sha256;
    if (fingerprint && seen.has(fingerprint)) f.same_as = seen.get(fingerprint);
    if (fingerprint) seen.set(fingerprint, f.id);
  }
  return { figures: items, figure_notes: notes, figure_audit_version: 1 };
}
