create table if not exists public.identity_field_buffer_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id text not null,
  item_id text not null,
  quick_feedback text null check (quick_feedback in ('hot', 'cold')),
  likes integer null check (likes is null or likes >= 0),
  memo text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists idx_identity_field_buffer_entries_user_pending
  on public.identity_field_buffer_entries (user_id, resolved_at, series_id, created_at desc);

