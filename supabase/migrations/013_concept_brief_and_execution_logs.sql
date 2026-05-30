-- Concept Forge canonical storage.
-- Keep the old vault_logs table for compatibility, but expose it with
-- Concept-era naming and store Concept Briefs on generation_series directly.

alter table public.generation_series
  add column if not exists concept_brief jsonb;

comment on column public.generation_series.concept_brief is
  'Canonical Concept Brief JSON generated/edited in Concept Forge.';

comment on table public.vault_logs is
  'Compatibility table for Concept execution logs. Formerly Evidence Vault logs.';

comment on column public.vault_logs.reaction_type is
  'Execution signal type. hot/cold are kept for compatibility and mean forward/revisit.';

create or replace view public.concept_run_logs
with (security_invoker = true)
as
select
  id,
  user_id,
  hypothesis_id,
  reaction_type as signal_type,
  sentiment_score,
  reaction_payload as signal_payload,
  is_synced_to_roots,
  synced_at,
  created_at,
  updated_at
from public.vault_logs;

comment on view public.concept_run_logs is
  'Concept-era alias for vault_logs. Use for new code; vault_logs remains for compatibility.';
