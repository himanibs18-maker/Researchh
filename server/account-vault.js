import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { fail } from "./http.js";
const VERSION = "research:v1:";
// Keys are private to the verified Supabase Auth account, not its public tables.
// This is application-layer encryption, not end-to-end encryption: the worker
// must read documents with the user's authorization to perform an analysis.
export async function updateAccount(req, data) {
  const r = await fetch(
    process.env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1/user",
    {
      method: "PUT",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: req.headers.authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!r.ok)
    throw fail(
      503,
      "Your private account settings could not be saved. Please retry.",
    );
  return r.json();
}
export async function accountKey(req, user, create = false) {
  let key = user.user_metadata?.research_vault_key;
  if (!key && create) {
    const updated = await updateAccount(req, {
      research_vault_key: randomBytes(32).toString("base64"),
    });
    key = updated.user_metadata?.research_vault_key;
  }
  if (!key || Buffer.from(key, "base64").length !== 32)
    throw fail(
      409,
      "This account has no initialized document vault. Start a new verification.",
    );
  return Buffer.from(key, "base64");
}
export function encryptBytes(bytes, key, context) {
  const nonce = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key, nonce);
  c.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([c.update(bytes), c.final()]);
  return Buffer.concat([nonce, c.getAuthTag(), encrypted]);
}
export function decryptBytes(bytes, key, context) {
  try {
    const b = Buffer.from(bytes);
    const c = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
    c.setAAD(Buffer.from(context));
    c.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([c.update(b.subarray(28)), c.final()]);
  } catch {
    throw fail(
      409,
      "The integrity of this protected record could not be verified. No content was disclosed.",
    );
  }
}
export function seal(data, key, context) {
  return (
    VERSION +
    encryptBytes(
      gzipSync(Buffer.from(JSON.stringify(data))),
      key,
      context,
    ).toString("base64")
  );
}
export function unseal(value, key, context) {
  if (typeof value !== "string" || !value.startsWith(VERSION))
    throw fail(409, "The record is not a valid encrypted workspace item.");
  const bytes = decryptBytes(
    Buffer.from(value.slice(VERSION.length), "base64"),
    key,
    context,
  );
  return JSON.parse(
    gunzipSync(bytes, { maxOutputLength: 32000000 }).toString(),
  );
}
export function protectReport(data, key) {
  return seal(data, key, `report:${data.user_id}:${data.id}`);
}
export function readReport(row, key) {
  return {
    ...unseal(row.extracted_text, key, `report:${row.user_id}:${row.id}`),
    created_at: row.created_at,
    updated_at: row.updated_at,
    lease_id: row.lease_id,
    lease_until: row.lease_until,
  };
}
export function viewReport(r) {
  const {
    extracted_text,
    storage_path,
    queue,
    user_id,
    lease_id,
    lease_until,
    ...safe
  } = r;
  return safe;
}
export const privateUploadsEnabled = () =>
  process.env.RESEARCH_ISOLATION_VERIFIED === "true";
