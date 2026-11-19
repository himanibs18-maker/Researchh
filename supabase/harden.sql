-- Database-owner deployment migration. Run before enabling confidential uploads.
-- These restrictive policies take precedence over permissive provisioning policies.
-- Existing data is preserved. Application requests never execute SQL.
begin;
-- Required by api/reports.js for encrypted original-document bytes.  Storage
-- buckets are separate from database tables, so this must be created explicitly
-- in each Supabase project before the first upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'research-vault',
  'research-vault',
  false,
  3145728,
  array['application/octet-stream']::text[]
)
on conflict (id) do nothing;
alter table public.research_reports enable row level security;
alter table public.research_bookmarks enable row level security;
alter table public.research_profiles enable row level security;
alter table public.research_papers enable row level security;
create policy research_confidential_reads on public.research_reports as restrictive for select to public using (user_id = auth.uid() or (user_id is null and is_sample));
create policy research_confidential_inserts on public.research_reports as restrictive for insert to public with check (user_id = auth.uid() and not is_sample);
create policy research_confidential_updates on public.research_reports as restrictive for update to public using (user_id = auth.uid() and not is_sample) with check (user_id = auth.uid() and not is_sample);
create policy research_confidential_deletes on public.research_reports as restrictive for delete to public using (user_id = auth.uid() and not is_sample);
create policy research_owner_writes on public.research_reports for all to authenticated using (user_id = auth.uid() and not is_sample) with check (user_id = auth.uid() and not is_sample);
create policy research_bookmarks_restrict on public.research_bookmarks as restrictive for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy research_profiles_restrict on public.research_profiles as restrictive for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke insert, update, delete, truncate on public.research_papers from anon, authenticated;
revoke truncate on public.research_reports, public.research_profiles, public.research_bookmarks from anon, authenticated;
create policy research_vault_owner on storage.objects as restrictive for all to public using (bucket_id not in ('research-vault','research-documents') or (auth.uid()::text = (storage.foldername(name))[1])) with check (bucket_id not in ('research-vault','research-documents') or (auth.uid()::text = (storage.foldername(name))[1]));
create policy research_vault_allow on storage.objects for all to authenticated using (bucket_id = 'research-vault' and auth.uid()::text = (storage.foldername(name))[1]) with check (bucket_id = 'research-vault' and auth.uid()::text = (storage.foldername(name))[1]);
create unique index if not exists research_bookmarks_owner_claim on public.research_bookmarks(user_id,report_id,claim_id);
create index if not exists research_report_history on public.research_reports(user_id, created_at desc);
alter table public.research_guest_records enable row level security;
create policy research_guest_capability_restrict on public.research_guest_records as restrictive for all to public
using (length(current_setting('request.headers',true)::jsonb->>'x-research-guest')=64 and owner_hash=encode(extensions.digest(current_setting('request.headers',true)::jsonb->>'x-research-guest','sha256'),'hex'))
with check (length(current_setting('request.headers',true)::jsonb->>'x-research-guest')=64 and owner_hash=encode(extensions.digest(current_setting('request.headers',true)::jsonb->>'x-research-guest','sha256'),'hex'));
revoke truncate on public.research_guest_records from anon,authenticated;
revoke insert,update,delete,truncate on public.research_source_directory,public.research_publication_details from anon,authenticated;
create index if not exists research_guest_scope on public.research_guest_records(owner_hash,kind,created_at desc);
commit;
