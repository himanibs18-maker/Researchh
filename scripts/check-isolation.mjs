// Run against two dedicated test accounts owned by the deployment operator.
// No destructive probes, guessed IDs, or queries against real users' content.
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const env = { ...loadEnv("production", process.cwd(), ""), ...process.env };
const client = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const a = client(),
  b = client(),
  anon = client();
for (const [k, c] of [
  ["A", a],
  ["B", b],
]) {
  if (!env["QA_" + k + "_EMAIL"] || !env["QA_" + k + "_PASSWORD"])
    throw new Error(
      "Supply two dedicated QA accounts via environment variables.",
    );
  const r = await c.auth.signInWithPassword({
    email: env["QA_" + k + "_EMAIL"],
    password: env["QA_" + k + "_PASSWORD"],
  });
  if (r.error) throw r.error;
}
const uid = (await a.auth.getUser()).data.user.id;
assert.notEqual(uid, (await b.auth.getUser()).data.user.id);
const id = randomUUID(),
  path = `${uid}/${id}.enc`;
let inserted = false,
  uploaded = false;
try {
  const r = await a
    .from("research_reports")
    .insert({
      id,
      user_id: uid,
      title: "Non-sensitive isolation test",
      file_name: "test",
      format: "test",
      status: "complete",
    })
    .select("id")
    .single();
  if (r.error) throw r.error;
  inserted = true;
  const s = await a.storage
    .from("research-vault")
    .upload(path, Buffer.from("Non-sensitive isolation test"), {
      contentType: "application/octet-stream",
    });
  if (s.error) throw s.error;
  uploaded = true;
  const failures = [];
  for (const [label, c] of [
    ["anonymous", anon],
    ["other test account", b],
  ]) {
    const row = await c
      .from("research_reports")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (row.data) failures.push(label + " can read the isolation fixture row");
    const blob = await c.storage.from("research-vault").download(path);
    if (!blob.error)
      failures.push(label + " can read the isolation fixture object");
  }
  if (failures.length)
    throw new Error(
      "Isolation not certified. " +
        failures.join("; ") +
        ". Apply the hardening migration.",
    );
  console.log(
    "PASS: own account reads work; anonymous and cross-account reads are denied.",
  );
} finally {
  if (uploaded) await a.storage.from("research-vault").remove([path]);
  if (inserted)
    await a.from("research_reports").delete().eq("id", id).eq("user_id", uid);
}
