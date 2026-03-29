alter table public.generations
add column if not exists generation_mode text not null default 'single';

alter table public.generations
add column if not exists memory_tags text[] not null default '{}';

alter table public.generations
drop constraint if exists generations_generation_mode_check;

alter table public.generations
add constraint generations_generation_mode_check
check (generation_mode in ('single', 'series'));

create table if not exists public.generation_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  source_draft text not null,
  emotion text not null,
  intensity integer not null,
  speed_mode text,
  advice_hint text,
  ghost_whisper text,
  quick_feedback text,
  memory_tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint generation_series_emotion_check
    check (emotion in ('empathy', 'toxic', 'mood', 'useful', 'minimal')),
  constraint generation_series_intensity_check
    check (intensity between 0 and 100),
  constraint generation_series_speed_mode_check
    check (speed_mode is null or speed_mode in ('flash', 'pro')),
  constraint generation_series_quick_feedback_check
    check (quick_feedback is null or quick_feedback in ('hot', 'cold'))
);

create table if not exists public.generation_series_items (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.generation_series(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot_key text not null,
  slot_label text not null,
  body text not null,
  hashtags text[] not null default '{}',
  quick_feedback text,
  likes integer,
  memo text,
  memory_tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint generation_series_items_slot_key_check
    check (slot_key in ('mon_problem', 'wed_solution', 'fri_emotion')),
  constraint generation_series_items_quick_feedback_check
    check (quick_feedback is null or quick_feedback in ('hot', 'cold')),
  constraint generation_series_items_likes_check
    check (likes is null or likes >= 0),
  constraint generation_series_items_unique_slot unique (series_id, slot_key)
);

create index if not exists generation_series_user_created_idx
  on public.generation_series (user_id, created_at desc)
  where deleted_at is null;

create index if not exists generation_series_items_series_idx
  on public.generation_series_items (series_id, created_at asc)
  where deleted_at is null;

create index if not exists generation_series_items_user_created_idx
  on public.generation_series_items (user_id, created_at desc)
  where deleted_at is null;

drop trigger if exists set_generation_series_updated_at on public.generation_series;
create trigger set_generation_series_updated_at
before update on public.generation_series
for each row
execute function public.set_updated_at();

drop trigger if exists set_generation_series_items_updated_at on public.generation_series_items;
create trigger set_generation_series_items_updated_at
before update on public.generation_series_items
for each row
execute function public.set_updated_at();

alter table public.generation_series enable row level security;
alter table public.generation_series_items enable row level security;

drop policy if exists generation_series_select_own on public.generation_series;
create policy generation_series_select_own
  on public.generation_series
  for select
  using (auth.uid() = user_id);

drop policy if exists generation_series_insert_own on public.generation_series;
create policy generation_series_insert_own
  on public.generation_series
  for insert
  with check (auth.uid() = user_id);

drop policy if exists generation_series_update_own on public.generation_series;
create policy generation_series_update_own
  on public.generation_series
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists generation_series_items_select_own on public.generation_series_items;
create policy generation_series_items_select_own
  on public.generation_series_items
  for select
  using (auth.uid() = user_id);

drop policy if exists generation_series_items_insert_own on public.generation_series_items;
create policy generation_series_items_insert_own
  on public.generation_series_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists generation_series_items_update_own on public.generation_series_items;
create policy generation_series_items_update_own
  on public.generation_series_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.create_generation_series_with_credit(
  p_user_id uuid,
  p_title text,
  p_source_draft text,
  p_emotion text,
  p_intensity integer,
  p_speed_mode text,
  p_items jsonb,
  p_advice_hint text default null,
  p_ghost_whisper text default null,
  p_memory_tags text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_series_id uuid;
  v_item jsonb;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select public.get_credit_balance(p_user_id) into v_balance;

  if v_balance <= 0 then
    raise exception 'NO_CREDITS_REMAINING';
  end if;

  insert into public.generation_series (
    user_id,
    title,
    source_draft,
    emotion,
    intensity,
    speed_mode,
    advice_hint,
    ghost_whisper,
    memory_tags
  )
  values (
    p_user_id,
    p_title,
    p_source_draft,
    p_emotion,
    p_intensity,
    p_speed_mode,
    p_advice_hint,
    p_ghost_whisper,
    coalesce(p_memory_tags, '{}')
  )
  returning id into v_series_id;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    insert into public.generation_series_items (
      series_id,
      user_id,
      slot_key,
      slot_label,
      body,
      hashtags
    )
    values (
      v_series_id,
      p_user_id,
      v_item ->> 'slotKey',
      v_item ->> 'slotLabel',
      v_item ->> 'body',
      coalesce(
        array(
          select jsonb_array_elements_text(coalesce(v_item -> 'hashtags', '[]'::jsonb))
        ),
        '{}'
      )
    );
  end loop;

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
    '連載生成のクレジット消費',
    jsonb_build_object('generation_series_id', v_series_id)
  );

  return v_series_id;
end;
$$;

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
) to authenticated;
