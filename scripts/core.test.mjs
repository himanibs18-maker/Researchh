import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Document, Paragraph, Packer } from "docx";
import { extractDocument, detect, assess } from "../server/review.js";
import { dois, mergeSources } from "../server/scholar.js";
import {
  seal,
  unseal,
  encryptBytes,
  decryptBytes,
} from "../server/account-vault.js";
const statement = "The optimal gap increased as test delay increased.";
test("extract a real PDF and its DOI references", async () => {
  const text = await extractDocument(
    await readFile("public/samples/sleep-and-learning-review.pdf"),
    "pdf",
  );
  assert.ok(text.includes("Sleep supports memory consolidation."));
  assert.ok(detect(text).claims.length >= 6);
  assert.equal(dois(text).length, 2);
});
test("extract real DOCX paragraphs", async () => {
  const d = new Document({
    sections: [{ children: [new Paragraph(statement)] }],
  });
  assert.equal(
    (await extractDocument(await Packer.toBuffer(d), "docx")).trim(),
    statement,
  );
});
test("reject a falsely named PDF before analysis", async () => {
  await assert.rejects(
    extractDocument(Buffer.from("not a document"), "pdf"),
    (e) => e.status === 422,
  );
});
test("preserve claim wording and detect DOI citation", () => {
  const d = detect(
    `${statement}\n\nReferences\nA reference. DOI: 10.1152/physrev.00032.2012.`,
  );
  assert.equal(d.claims[0].text, statement);
  assert.ok(d.citations.some((c) => c.value === "10.1152/physrev.00032.2012"));
});
test("unverified claims are never assigned a fabricated score", async () => {
  const c = await assess({ id: "C001", text: statement }, []);
  assert.equal(c.status, "Needs Review");
  assert.equal(c.confidence, null);
  assert.equal(c.evidence, "");
});
test("literal abstract match has a text score, not AI confidence", async () => {
  const c = await assess({ id: "C001", text: statement }, [
    { id: "test-source", title: "Test fixture", abstract: statement },
  ]);
  assert.equal(c.method, "Exact abstract match");
  assert.equal(c.evidence, statement);
});
test("mathematical comparators cannot be normalized into a match", async () => {
  const c = await assess(
    { id: "C001", text: "The measured sample size was > 400 in the study." },
    [
      {
        id: "test-source",
        title: "Test fixture",
        abstract: "The measured sample size was < 400 in the study.",
      },
    ],
  );
  assert.notEqual(c.method, "Exact abstract match");
});
test("matching DOI records are deduplicated without losing provenance", () => {
  const s = { id: "fixture", abstract: "A", providers: ["Crossref"] };
  const m = mergeSources([s, { ...s, providers: ["OpenAlex"] }]);
  assert.equal(m.length, 1);
  assert.deepEqual(m[0].providers, ["Crossref", "OpenAlex"]);
});
test("encrypted content is bound to account and document identity", () => {
  const a = randomBytes(32),
    b = randomBytes(32);
  const sealed = seal({ claim: statement }, a, "account-A:document-1");
  assert.ok(!sealed.includes(statement));
  assert.deepEqual(unseal(sealed, a, "account-A:document-1"), {
    claim: statement,
  });
  assert.throws(() => unseal(sealed, b, "account-A:document-1"));
  assert.throws(() => unseal(sealed, a, "account-A:document-2"));
});
test("authenticated original document encryption is byte-preserving", () => {
  const bytes = randomBytes(5000),
    key = randomBytes(32),
    blob = encryptBytes(bytes, key, "file-1");
  assert.deepEqual(decryptBytes(blob, key, "file-1"), bytes);
  blob[blob.length - 1] ^= 1;
  assert.throws(() => decryptBytes(blob, key, "file-1"));
});
