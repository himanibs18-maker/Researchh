// The platform client accepts either a service credential or a publishable one.
// A publishable credential never gains service privileges. All private operations
// below use the verified user's scoped client and an account-specific envelope.
if (
  !process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
