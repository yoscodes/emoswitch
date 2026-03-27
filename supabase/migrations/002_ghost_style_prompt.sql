alter table public.ghost_settings
add column if not exists style_prompt text not null default '';
