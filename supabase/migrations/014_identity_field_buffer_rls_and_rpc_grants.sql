-- Tighten RLS/grants for release.
-- Server routes use the service role client; browser clients should not be able
-- to bypass API-level checks by writing sync queues or calling credit RPCs.

alter table public.identity_field_buffer_entries enable row level security;

drop policy if exists identity_field_buffer_entries_select_own
  on public.identity_field_buffer_entries;
create policy identity_field_buffer_entries_select_own
  on public.identity_field_buffer_entries
  for select
  using (auth.uid() = user_id);

drop policy if exists identity_field_buffer_entries_insert_own
  on public.identity_field_buffer_entries;
create policy identity_field_buffer_entries_insert_own
  on public.identity_field_buffer_entries
  for insert
  with check (auth.uid() = user_id);

drop policy if exists identity_field_buffer_entries_update_own
  on public.identity_field_buffer_entries;
create policy identity_field_buffer_entries_update_own
  on public.identity_field_buffer_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on function public.create_generation_with_credit(
  uuid,
  text,
  text,
  integer,
  text,
  text[],
  text[],
  integer,
  integer,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.create_generation_with_credit(
  uuid,
  text,
  text,
  integer,
  text,
  text[],
  text[],
  integer,
  integer,
  text,
  text
) to service_role;

revoke all on function public.create_generation_series_with_credit(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  jsonb,
  text,
  text,
  text[]
) from public, anon, authenticated;

grant execute on function public.create_generation_series_with_credit(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  jsonb,
  text,
  text,
  text[]
) to service_role;
