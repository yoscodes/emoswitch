create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  default_emotion text not null default 'empathy',
  writing_style text not null default 'casual',
  sentence_style text not null default 'friendly',
  is_demo boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_default_emotion_check
    check (default_emotion in ('empathy', 'toxic', 'mood', 'useful', 'minimal')),
  constraint profiles_writing_style_check
    check (writing_style in ('polite', 'casual', 'passionate')),
  constraint profiles_sentence_style_check
    check (sentence_style in ('desumasu', 'friendly'))
);

create table if not exists public.ghost_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  profile_url text not null default '',
  ng_words text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ghost_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_url text not null,
  source_type text not null default 'profile',
  status text not null default 'ready',
  imported_post_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint ghost_sources_type_check
    check (source_type in ('profile', 'post')),
  constraint ghost_sources_status_check
    check (status in ('pending', 'ready', 'failed'))
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  draft text not null,
  emotion text not null,
  intensity integer not null,
  speed_mode text,
  variants text[] not null,
  hashtags text[] not null,
  selected_index integer,
  likes integer,
  memo text,
  advice_hint text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint generations_emotion_check
    check (emotion in ('empathy', 'toxic', 'mood', 'useful', 'minimal')),
  constraint generations_intensity_check
    check (intensity between 0 and 100),
  constraint generations_speed_mode_check
    check (speed_mode is null or speed_mode in ('flash', 'pro')),
  constraint generations_variants_len_check
    check (coalesce(array_length(variants, 1), 0) = 3),
  constraint generations_hashtags_len_check
    check (coalesce(array_length(hashtags, 1), 0) between 3 and 8),
  constraint generations_selected_index_check
    check (selected_index is null or selected_index between 0 and 2),
  constraint generations_likes_check
    check (likes is null or likes >= 0)
);

create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint credit_ledger_delta_check
    check (delta <> 0),
  constraint credit_ledger_reason_check
    check (reason in ('free_grant', 'generation', 'topup', 'admin_seed', 'migration_import'))
);

create table if not exists public.ghost_embeddings (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_id uuid references public.ghost_sources(id) on delete set null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists generations_user_created_idx
  on public.generations (user_id, created_at desc)
  where deleted_at is null;

create index if not exists ghost_sources_user_created_idx
  on public.ghost_sources (user_id, created_at desc)
  where deleted_at is null;

create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_ghost_settings_updated_at on public.ghost_settings;
create trigger set_ghost_settings_updated_at
before update on public.ghost_settings
for each row
execute function public.set_updated_at();

drop trigger if exists set_ghost_sources_updated_at on public.ghost_sources;
create trigger set_ghost_sources_updated_at
before update on public.ghost_sources
for each row
execute function public.set_updated_at();

drop trigger if exists set_generations_updated_at on public.generations;
create trigger set_generations_updated_at
before update on public.generations
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_is_demo boolean;
begin
  v_display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, new.id::text), '@', 1)
  );
  v_is_demo := coalesce(new.raw_user_meta_data ->> 'is_demo', 'false') = 'true';

  insert into public.profiles (
    id,
    email,
    display_name,
    is_demo
  )
  values (
    new.id,
    coalesce(new.email, new.id::text || '@users.emoswitch.local'),
    v_display_name,
    v_is_demo
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    is_demo = excluded.is_demo;

  insert into public.ghost_settings (
    user_id,
    profile_url,
    ng_words
  )
  values (
    new.id,
    '',
    '{}'
  )
  on conflict (user_id) do nothing;

  if not v_is_demo then
    insert into public.credit_ledger (
      user_id,
      delta,
      reason,
      note,
      metadata
    )
    values (
      new.id,
      10,
      'free_grant',
      '新規登録ボーナス',
      jsonb_build_object('source', 'auth_trigger')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.ghost_settings enable row level security;
alter table public.ghost_sources enable row level security;
alter table public.generations enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.ghost_embeddings enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists ghost_settings_select_own on public.ghost_settings;
create policy ghost_settings_select_own
  on public.ghost_settings
  for select
  using (auth.uid() = user_id);

drop policy if exists ghost_settings_insert_own on public.ghost_settings;
create policy ghost_settings_insert_own
  on public.ghost_settings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists ghost_settings_update_own on public.ghost_settings;
create policy ghost_settings_update_own
  on public.ghost_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists ghost_sources_select_own on public.ghost_sources;
create policy ghost_sources_select_own
  on public.ghost_sources
  for select
  using (auth.uid() = user_id and deleted_at is null);

drop policy if exists ghost_sources_insert_own on public.ghost_sources;
create policy ghost_sources_insert_own
  on public.ghost_sources
  for insert
  with check (auth.uid() = user_id);

drop policy if exists ghost_sources_update_own on public.ghost_sources;
create policy ghost_sources_update_own
  on public.ghost_sources
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists generations_select_own on public.generations;
create policy generations_select_own
  on public.generations
  for select
  using (auth.uid() = user_id and deleted_at is null);

drop policy if exists generations_insert_own on public.generations;
create policy generations_insert_own
  on public.generations
  for insert
  with check (auth.uid() = user_id);

drop policy if exists generations_update_own on public.generations;
create policy generations_update_own
  on public.generations
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists credit_ledger_select_own on public.credit_ledger;
create policy credit_ledger_select_own
  on public.credit_ledger
  for select
  using (auth.uid() = user_id);

drop policy if exists ghost_embeddings_select_own on public.ghost_embeddings;
create policy ghost_embeddings_select_own
  on public.ghost_embeddings
  for select
  using (auth.uid() = user_id and deleted_at is null);

drop policy if exists ghost_embeddings_insert_own on public.ghost_embeddings;
create policy ghost_embeddings_insert_own
  on public.ghost_embeddings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists ghost_embeddings_update_own on public.ghost_embeddings;
create policy ghost_embeddings_update_own
  on public.ghost_embeddings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.get_credit_balance(p_user_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(delta), 0)::integer
  from public.credit_ledger
  where user_id = p_user_id;
$$;

create or replace function public.get_credit_summary(p_user_id uuid)
returns table (
  remaining integer,
  used integer,
  granted integer
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(sum(delta), 0)::integer as remaining,
    coalesce(abs(sum(case when delta < 0 then delta else 0 end)), 0)::integer as used,
    coalesce(sum(case when delta > 0 then delta else 0 end), 0)::integer as granted
  from public.credit_ledger
  where user_id = p_user_id;
$$;

create or replace function public.create_generation_with_credit(
  p_user_id uuid,
  p_draft text,
  p_emotion text,
  p_intensity integer,
  p_speed_mode text,
  p_variants text[],
  p_hashtags text[],
  p_selected_index integer default null,
  p_likes integer default null,
  p_memo text default null,
  p_advice_hint text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_generation_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select public.get_credit_balance(p_user_id) into v_balance;

  if v_balance <= 0 then
    raise exception 'NO_CREDITS_REMAINING';
  end if;

  insert into public.generations (
    user_id,
    draft,
    emotion,
    intensity,
    speed_mode,
    variants,
    hashtags,
    selected_index,
    likes,
    memo,
    advice_hint
  )
  values (
    p_user_id,
    p_draft,
    p_emotion,
    p_intensity,
    p_speed_mode,
    p_variants,
    p_hashtags,
    p_selected_index,
    p_likes,
    p_memo,
    p_advice_hint
  )
  returning id into v_generation_id;

  insert into public.credit_ledger (
    user_id,
    delta,
    reason,
    note,
    metadata
  )
  values (
    p_user_id,
    -1,
    'generation',
    '3案生成のクレジット消費',
    jsonb_build_object('generation_id', v_generation_id)
  );

  return v_generation_id;
end;
$$;

grant execute on function public.get_credit_balance(uuid) to authenticated;
grant execute on function public.get_credit_summary(uuid) to authenticated;
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
) to authenticated;
