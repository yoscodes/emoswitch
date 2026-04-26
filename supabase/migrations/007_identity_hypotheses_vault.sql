-- Pivot-ready schema for Identity / Lab / Vault
-- Adds:
--   1) identities   : identity core state snapshot per user
--   2) hypotheses   : each deploy experiment from /lab
--   3) vault_logs   : market reactions and ROOTS sync queue

create or replace function public.validate_identity_dna_axes(p jsonb)
returns boolean
language sql
immutable
as $$
  with allowed as (
    select unnest(array[
      'logic_vs_emotion',
      'break_vs_harmony',
      'crowd_vs_solitude',
      'speed_vs_density',
      'utility_vs_philosophy',
      'persona_keywords',
      'persona_summary'
    ]) as key
  )
  select
    coalesce(jsonb_typeof(p), 'object') = 'object'
    and not exists (
      select 1
      from jsonb_object_keys(coalesce(p, '{}'::jsonb)) as k
      where k not in (select key from allowed)
    )
    and (
      not (coalesce(p, '{}'::jsonb) ? 'persona_keywords')
      or jsonb_typeof(p->'persona_keywords') = 'array'
    )
    and (
      not (coalesce(p, '{}'::jsonb) ? 'persona_summary')
      or jsonb_typeof(p->'persona_summary') = 'string'
    );
$$;

create table if not exists public.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  dna_axes jsonb not null default '{}'::jsonb,
  my_taboo jsonb not null default '{}'::jsonb,
  current_prophecy text not null default '平均的な起業家',
  dna_completeness integer not null default 0,
  version integer not null default 1,
  source_summary text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint identities_dna_completeness_check
    check (dna_completeness between 0 and 100),
  constraint identities_dna_axes_schema_check
    check (public.validate_identity_dna_axes(dna_axes)),
  constraint identities_version_check
    check (version >= 1)
);

create table if not exists public.hypotheses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_hypothesis_id uuid references public.hypotheses(id) on delete set null,
  legacy_source_type text,
  legacy_source_id uuid,
  generation_mode text not null default 'single',
  seed_input text not null default '',
  strategy_params jsonb not null default '{}'::jsonb,
  identity_snapshot jsonb not null default '{}'::jsonb,
  output_content jsonb not null default '{}'::jsonb,
  status text not null default 'deployed',
  deployed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint hypotheses_generation_mode_check
    check (generation_mode in ('single', 'series')),
  constraint hypotheses_status_check
    check (status in ('draft', 'deployed', 'archived')),
  constraint hypotheses_parent_not_self_check
    check (parent_hypothesis_id is null or parent_hypothesis_id <> id),
  constraint hypotheses_legacy_source_type_check
    check (legacy_source_type is null or legacy_source_type in ('generation', 'series'))
);

create unique index if not exists hypotheses_legacy_unique_idx
  on public.hypotheses (legacy_source_type, legacy_source_id);

create table if not exists public.vault_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  hypothesis_id uuid not null references public.hypotheses(id) on delete cascade,
  reaction_type text not null,
  sentiment_score double precision,
  reaction_payload jsonb not null default '{}'::jsonb,
  is_synced_to_roots boolean not null default false,
  synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vault_logs_reaction_type_check
    check (reaction_type in ('hot', 'cold', 'ignore', 'feedback', 'memo')),
  constraint vault_logs_sentiment_score_check
    check (sentiment_score is null or (sentiment_score >= -1.0 and sentiment_score <= 1.0))
);

alter table public.identities
  add column if not exists dna_axes jsonb not null default '{}'::jsonb;

alter table public.hypotheses
  add column if not exists parent_hypothesis_id uuid references public.hypotheses(id) on delete set null;

alter table public.vault_logs
  add column if not exists sentiment_score double precision;

alter table public.identities
  drop constraint if exists identities_dna_axes_schema_check;
alter table public.identities
  add constraint identities_dna_axes_schema_check
  check (public.validate_identity_dna_axes(dna_axes));

alter table public.hypotheses
  drop constraint if exists hypotheses_parent_not_self_check;
alter table public.hypotheses
  add constraint hypotheses_parent_not_self_check
  check (parent_hypothesis_id is null or parent_hypothesis_id <> id);

alter table public.vault_logs
  drop constraint if exists vault_logs_sentiment_score_check;
alter table public.vault_logs
  add constraint vault_logs_sentiment_score_check
  check (sentiment_score is null or (sentiment_score >= -1.0 and sentiment_score <= 1.0));

create index if not exists identities_user_idx
  on public.identities (user_id);

create index if not exists hypotheses_user_created_idx
  on public.hypotheses (user_id, created_at desc)
  where deleted_at is null;

create index if not exists hypotheses_parent_idx
  on public.hypotheses (parent_hypothesis_id, created_at desc);

create index if not exists hypotheses_mode_created_idx
  on public.hypotheses (generation_mode, created_at desc)
  where deleted_at is null;

create index if not exists vault_logs_hypothesis_created_idx
  on public.vault_logs (hypothesis_id, created_at desc);

create index if not exists vault_logs_user_synced_idx
  on public.vault_logs (user_id, is_synced_to_roots, created_at desc);

drop trigger if exists set_identities_updated_at on public.identities;
create trigger set_identities_updated_at
before update on public.identities
for each row
execute function public.set_updated_at();

drop trigger if exists set_hypotheses_updated_at on public.hypotheses;
create trigger set_hypotheses_updated_at
before update on public.hypotheses
for each row
execute function public.set_updated_at();

drop trigger if exists set_vault_logs_updated_at on public.vault_logs;
create trigger set_vault_logs_updated_at
before update on public.vault_logs
for each row
execute function public.set_updated_at();

alter table public.identities enable row level security;
alter table public.hypotheses enable row level security;
alter table public.vault_logs enable row level security;

drop policy if exists identities_select_own on public.identities;
create policy identities_select_own
  on public.identities
  for select
  using (auth.uid() = user_id);

drop policy if exists identities_insert_own on public.identities;
create policy identities_insert_own
  on public.identities
  for insert
  with check (auth.uid() = user_id);

drop policy if exists identities_update_own on public.identities;
create policy identities_update_own
  on public.identities
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists hypotheses_select_own on public.hypotheses;
create policy hypotheses_select_own
  on public.hypotheses
  for select
  using (auth.uid() = user_id and deleted_at is null);

drop policy if exists hypotheses_insert_own on public.hypotheses;
create policy hypotheses_insert_own
  on public.hypotheses
  for insert
  with check (auth.uid() = user_id);

drop policy if exists hypotheses_update_own on public.hypotheses;
create policy hypotheses_update_own
  on public.hypotheses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists vault_logs_select_own on public.vault_logs;
create policy vault_logs_select_own
  on public.vault_logs
  for select
  using (auth.uid() = user_id);

drop policy if exists vault_logs_insert_own on public.vault_logs;
create policy vault_logs_insert_own
  on public.vault_logs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists vault_logs_update_own on public.vault_logs;
create policy vault_logs_update_own
  on public.vault_logs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Backfill identities from ghost_settings.
insert into public.identities (
  user_id,
  dna_axes,
  my_taboo,
  current_prophecy,
  dna_completeness,
  version,
  source_summary,
  created_at,
  updated_at
)
select
  gs.user_id,
  jsonb_build_object(
    'logic_vs_emotion', (select split_part(mp, '|', 3) from unnest(gs.manual_posts) as mp where mp like 'dna_choice|logic_vs_emotion|%' limit 1),
    'break_vs_harmony', (select split_part(mp, '|', 3) from unnest(gs.manual_posts) as mp where mp like 'dna_choice|break_vs_harmony|%' limit 1),
    'crowd_vs_solitude', (select split_part(mp, '|', 3) from unnest(gs.manual_posts) as mp where mp like 'dna_choice|crowd_vs_solitude|%' limit 1),
    'speed_vs_density', (select split_part(mp, '|', 3) from unnest(gs.manual_posts) as mp where mp like 'dna_choice|speed_vs_density|%' limit 1),
    'utility_vs_philosophy', (select split_part(mp, '|', 3) from unnest(gs.manual_posts) as mp where mp like 'dna_choice|utility_vs_philosophy|%' limit 1),
    'persona_keywords', to_jsonb(gs.persona_keywords),
    'persona_summary', gs.persona_summary
  ),
  jsonb_build_object(
    'anti_persona', coalesce(
      (select jsonb_agg(replace(mp, 'anti_persona|', '')) from unnest(gs.manual_posts) as mp where mp like 'anti_persona|%'),
      '[]'::jsonb
    ),
    'ng_words', to_jsonb(gs.ng_words)
  ),
  coalesce(nullif(gs.persona_summary, ''), '平均的な起業家'),
  least(
    100,
    greatest(
      0,
      coalesce(array_length(gs.persona_keywords, 1), 0) * 8
      + case when gs.persona_summary <> '' then 22 else 0 end
      + least(coalesce(array_length(gs.manual_posts, 1), 0), 8) * 5
      + case when gs.persona_status = 'approved' then 15 when gs.persona_status = 'draft' then 7 else 0 end
    )
  ),
  1,
  'ghost_settings から自動移行',
  gs.created_at,
  gs.updated_at
from public.ghost_settings gs
on conflict (user_id) do update
set
  dna_axes = excluded.dna_axes,
  my_taboo = excluded.my_taboo,
  current_prophecy = excluded.current_prophecy,
  dna_completeness = excluded.dna_completeness,
  source_summary = excluded.source_summary,
  updated_at = excluded.updated_at;

-- Backfill hypotheses from generations (single).
insert into public.hypotheses (
  user_id,
  legacy_source_type,
  legacy_source_id,
  generation_mode,
  seed_input,
  strategy_params,
  identity_snapshot,
  output_content,
  status,
  deployed_at,
  created_at,
  updated_at,
  deleted_at
)
select
  g.user_id,
  'generation',
  g.id,
  'single',
  g.draft,
  jsonb_build_object(
    'emotion', g.emotion,
    'intensity', g.intensity,
    'speed_mode', g.speed_mode
  ),
  coalesce(
    jsonb_build_object(
      'identity_version', i.version,
      'current_prophecy', i.current_prophecy,
      'dna_completeness', i.dna_completeness,
      'dna_axes', i.dna_axes,
      'my_taboo', i.my_taboo
    ),
    '{}'::jsonb
  ),
  jsonb_build_object(
    'variants', to_jsonb(g.variants),
    'hashtags', to_jsonb(g.hashtags),
    'selected_index', g.selected_index,
    'advice_hint', g.advice_hint,
    'memory_tags', to_jsonb(g.memory_tags)
  ),
  case when g.deleted_at is null then 'deployed' else 'archived' end,
  g.created_at,
  g.created_at,
  g.updated_at,
  g.deleted_at
from public.generations g
left join public.identities i on i.user_id = g.user_id
on conflict (legacy_source_type, legacy_source_id) do update
set
  strategy_params = excluded.strategy_params,
  identity_snapshot = excluded.identity_snapshot,
  output_content = excluded.output_content,
  status = excluded.status,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

-- Backfill hypotheses from generation_series (series).
insert into public.hypotheses (
  user_id,
  legacy_source_type,
  legacy_source_id,
  generation_mode,
  seed_input,
  strategy_params,
  identity_snapshot,
  output_content,
  status,
  deployed_at,
  created_at,
  updated_at,
  deleted_at
)
select
  s.user_id,
  'series',
  s.id,
  'series',
  s.source_draft,
  jsonb_build_object(
    'emotion', s.emotion,
    'intensity', s.intensity,
    'speed_mode', s.speed_mode,
    'title', s.title
  ),
  coalesce(
    jsonb_build_object(
      'identity_version', i.version,
      'current_prophecy', i.current_prophecy,
      'dna_completeness', i.dna_completeness,
      'dna_axes', i.dna_axes,
      'my_taboo', i.my_taboo
    ),
    '{}'::jsonb
  ),
  jsonb_build_object(
    'title', s.title,
    'advice_hint', s.advice_hint,
    'ghost_whisper', s.ghost_whisper,
    'memory_tags', to_jsonb(s.memory_tags),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', si.id,
          'slot_key', si.slot_key,
          'slot_label', si.slot_label,
          'body', si.body,
          'hashtags', to_jsonb(si.hashtags),
          'quick_feedback', si.quick_feedback,
          'likes', si.likes,
          'memo', si.memo,
          'memory_tags', to_jsonb(si.memory_tags),
          'created_at', si.created_at
        )
        order by si.created_at asc
      )
      from public.generation_series_items si
      where si.series_id = s.id and si.deleted_at is null
    ), '[]'::jsonb)
  ),
  case when s.deleted_at is null then 'deployed' else 'archived' end,
  s.created_at,
  s.created_at,
  s.updated_at,
  s.deleted_at
from public.generation_series s
left join public.identities i on i.user_id = s.user_id
on conflict (legacy_source_type, legacy_source_id) do update
set
  strategy_params = excluded.strategy_params,
  identity_snapshot = excluded.identity_snapshot,
  output_content = excluded.output_content,
  status = excluded.status,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

-- Backfill vault_logs from single generations feedback.
insert into public.vault_logs (
  user_id,
  hypothesis_id,
  reaction_type,
  reaction_payload,
  is_synced_to_roots,
  created_at,
  updated_at
)
select
  g.user_id,
  h.id,
  g.quick_feedback,
  jsonb_build_object(
    'source', 'generations.quick_feedback'
  ),
  false,
  g.updated_at,
  g.updated_at
from public.generations g
join public.hypotheses h
  on h.legacy_source_type = 'generation'
 and h.legacy_source_id = g.id
where g.quick_feedback in ('hot', 'cold');

insert into public.vault_logs (
  user_id,
  hypothesis_id,
  reaction_type,
  reaction_payload,
  is_synced_to_roots,
  created_at,
  updated_at
)
select
  g.user_id,
  h.id,
  'feedback',
  jsonb_build_object(
    'likes', g.likes,
    'source', 'generations.likes'
  ),
  false,
  g.updated_at,
  g.updated_at
from public.generations g
join public.hypotheses h
  on h.legacy_source_type = 'generation'
 and h.legacy_source_id = g.id
where g.likes is not null;

insert into public.vault_logs (
  user_id,
  hypothesis_id,
  reaction_type,
  reaction_payload,
  is_synced_to_roots,
  created_at,
  updated_at
)
select
  g.user_id,
  h.id,
  'memo',
  jsonb_build_object(
    'memo', g.memo,
    'source', 'generations.memo'
  ),
  false,
  g.updated_at,
  g.updated_at
from public.generations g
join public.hypotheses h
  on h.legacy_source_type = 'generation'
 and h.legacy_source_id = g.id
where g.memo is not null and g.memo <> '';

-- Backfill vault_logs from series-level and series-item feedback.
insert into public.vault_logs (
  user_id,
  hypothesis_id,
  reaction_type,
  reaction_payload,
  is_synced_to_roots,
  created_at,
  updated_at
)
select
  s.user_id,
  h.id,
  s.quick_feedback,
  jsonb_build_object(
    'source', 'generation_series.quick_feedback'
  ),
  false,
  s.updated_at,
  s.updated_at
from public.generation_series s
join public.hypotheses h
  on h.legacy_source_type = 'series'
 and h.legacy_source_id = s.id
where s.quick_feedback in ('hot', 'cold');

insert into public.vault_logs (
  user_id,
  hypothesis_id,
  reaction_type,
  reaction_payload,
  is_synced_to_roots,
  created_at,
  updated_at
)
select
  si.user_id,
  h.id,
  si.quick_feedback,
  jsonb_build_object(
    'series_item_id', si.id,
    'slot_key', si.slot_key,
    'source', 'generation_series_items.quick_feedback'
  ),
  false,
  si.updated_at,
  si.updated_at
from public.generation_series_items si
join public.hypotheses h
  on h.legacy_source_type = 'series'
 and h.legacy_source_id = si.series_id
where si.quick_feedback in ('hot', 'cold');

insert into public.vault_logs (
  user_id,
  hypothesis_id,
  reaction_type,
  reaction_payload,
  is_synced_to_roots,
  created_at,
  updated_at
)
select
  si.user_id,
  h.id,
  'feedback',
  jsonb_build_object(
    'series_item_id', si.id,
    'slot_key', si.slot_key,
    'likes', si.likes,
    'source', 'generation_series_items.likes'
  ),
  false,
  si.updated_at,
  si.updated_at
from public.generation_series_items si
join public.hypotheses h
  on h.legacy_source_type = 'series'
 and h.legacy_source_id = si.series_id
where si.likes is not null;

insert into public.vault_logs (
  user_id,
  hypothesis_id,
  reaction_type,
  reaction_payload,
  is_synced_to_roots,
  created_at,
  updated_at
)
select
  si.user_id,
  h.id,
  'memo',
  jsonb_build_object(
    'series_item_id', si.id,
    'slot_key', si.slot_key,
    'memo', si.memo,
    'source', 'generation_series_items.memo'
  ),
  false,
  si.updated_at,
  si.updated_at
from public.generation_series_items si
join public.hypotheses h
  on h.legacy_source_type = 'series'
 and h.legacy_source_id = si.series_id
where si.memo is not null and si.memo <> '';
