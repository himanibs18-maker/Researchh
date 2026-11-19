import { createClient } from "@supabase/supabase-js";
export function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
export function fail(status, message) {
  return Object.assign(new Error(message), { status });
}
export async function identity(req, db) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token)
    throw fail(401, "Please sign in to access your private workspace.");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw fail(401, "Your session has expired. Please sign in again.");
  const scoped = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return { user: data.user, scoped };
}
export function sendError(res, e) {
  const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
  if (status === 500)
    console.error("Research API:", e.code || e.name, e.message?.slice(0, 180));
  res.status(status).json({
    error:
      status === 500
        ? "The service could not complete this request. Please try again."
        : e.message,
  });
}
export function must(result) {
  if (result.error) throw result.error;
  return result.data;
}
export function allowed(req, methods) {
  if (!methods.includes(req.method))
    throw fail(405, "This request method is not supported.");
}
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validId(id) {
  if (!UUID.test(id || "")) throw fail(400, "Invalid record identifier.");
  return id;
}
