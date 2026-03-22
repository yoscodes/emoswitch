-- 将来: Supabase + pgvector でサーバー永続化する際の参考スキーマ
-- 現状はブラウザ localStorage で同等データを保持しています。

-- create extension if not exists vector;

-- create table public.profiles (
--   id uuid primary key references auth.users on delete cascade,
--   display_name text,
--   created_at timestamptz default now()
-- );

-- create table public.generations (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid references public.profiles(id) on delete cascade,
--   draft text not null,
--   emotion text not null,
--   intensity int not null,
--   variants text[] not null,
--   hashtags text[] not null,
--   selected_index int,
--   likes int,
--   advice_hint text,
--   created_at timestamptz default now()
-- );

-- create table public.ghost_settings (
--   user_id uuid primary key references public.profiles(id) on delete cascade,
--   profile_url text,
--   ng_words text[] default '{}',
--   updated_at timestamptz default now()
-- );

-- create table public.post_embeddings (
--   id bigserial primary key,
--   user_id uuid references public.profiles(id) on delete cascade,
--   content text not null,
--   embedding vector(1536),
--   created_at timestamptz default now()
-- );
