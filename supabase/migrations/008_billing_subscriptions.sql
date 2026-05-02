alter table public.profiles
  add column if not exists plan_tier text not null default 'free';

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists ai_wall_deep_enabled boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_plan_tier_check;

alter table public.profiles
  add constraint profiles_plan_tier_check
  check (plan_tier in ('free', 'basic', 'creator', 'pro'));

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  status text not null,
  plan_tier text not null default 'free',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subscriptions_status_check
    check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  constraint subscriptions_plan_tier_check
    check (plan_tier in ('free', 'basic', 'creator', 'pro'))
);

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, created_at desc);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id, created_at desc);

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions
  for select
  using (auth.uid() = user_id);
