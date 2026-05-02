alter table public.profiles
  add column if not exists subscription_tier text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_subscription_tier_check;

alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'basic', 'creator', 'pro'));

update public.profiles
set subscription_tier = coalesce(plan_tier, 'free')
where subscription_tier is null
   or subscription_tier <> coalesce(plan_tier, 'free');

alter table public.subscriptions
  add column if not exists subscription_tier text not null default 'free';

alter table public.subscriptions
  drop constraint if exists subscriptions_subscription_tier_check;

alter table public.subscriptions
  add constraint subscriptions_subscription_tier_check
  check (subscription_tier in ('free', 'basic', 'creator', 'pro'));

update public.subscriptions
set subscription_tier = coalesce(plan_tier, 'free')
where subscription_tier is null
   or subscription_tier <> coalesce(plan_tier, 'free');
