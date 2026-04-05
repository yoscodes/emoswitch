alter table public.ghost_settings
  add column if not exists persona_keywords text[] not null default '{}',
  add column if not exists persona_summary text not null default '',
  add column if not exists persona_evidence text[] not null default '{}',
  add column if not exists persona_status text not null default 'empty';

alter table public.ghost_settings
  drop constraint if exists ghost_settings_persona_status_check;

alter table public.ghost_settings
  add constraint ghost_settings_persona_status_check
  check (persona_status in ('empty', 'draft', 'approved'));

update public.ghost_settings
set
  persona_keywords = case
    when coalesce(array_length(persona_keywords, 1), 0) = 0
      then array['やさしい余韻', '短文中心', '共感の導入', '断定しすぎない', '夜に合う空気感']
    else persona_keywords
  end,
  persona_summary = case
    when persona_summary = ''
      then 'やわらかい共感から入り、短い文で余韻を残す発信スタイル。強い断定よりも、読む人が自分ごと化しやすい距離感を優先する。'
    else persona_summary
  end,
  persona_evidence = case
    when coalesce(array_length(persona_evidence, 1), 0) = 0
      then array[
        '共感トーンの成功投稿が多く、読者の感情を受け止める始まり方が目立つ',
        '長文よりも1文完結の短文でまとまる傾向がある',
        'NGワード設定と文体メモから、強すぎる言い回しを避けたい意図が見える'
      ]
    else persona_evidence
  end,
  persona_status = case
    when persona_status = 'empty' then 'approved'
    else persona_status
  end
where user_id = '11111111-1111-4111-8111-111111111111';
