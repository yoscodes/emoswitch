alter table public.generations
add column if not exists quick_feedback text;

alter table public.generations
drop constraint if exists generations_quick_feedback_check;

alter table public.generations
add constraint generations_quick_feedback_check
check (quick_feedback is null or quick_feedback in ('hot', 'cold'));
