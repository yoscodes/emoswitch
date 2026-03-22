do $$
declare
  demo_user_id uuid := '11111111-1111-4111-8111-111111111111';
  demo_email text := 'demo@emoswitch.local';
  demo_now timestamptz := timezone('utc', now());
begin
  if not exists (
    select 1 from auth.users where id = demo_user_id
  ) then
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      demo_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      demo_email,
      crypt('EmoSwitchDemo#2026', gen_salt('bf')),
      demo_now,
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"デモユーザー","is_demo":true}'::jsonb,
      demo_now,
      demo_now
    );
  end if;
end
$$;

insert into public.profiles (
  id,
  email,
  display_name,
  is_demo
)
values (
  '11111111-1111-4111-8111-111111111111',
  'demo@emoswitch.local',
  'デモユーザー',
  true
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
  '11111111-1111-4111-8111-111111111111',
  'https://x.com/emo_switch_demo',
  array['炎上', '上から目線', 'マジで']
)
on conflict (user_id) do update
set
  profile_url = excluded.profile_url,
  ng_words = excluded.ng_words;

insert into public.ghost_sources (
  id,
  user_id,
  source_url,
  source_type,
  status,
  imported_post_count,
  created_at,
  updated_at
)
values
  (
    '22222222-2222-4222-8222-222222222221',
    '11111111-1111-4111-8111-111111111111',
    'https://x.com/emo_switch_demo',
    'profile',
    'ready',
    28,
    timezone('utc', now()) - interval '6 days',
    timezone('utc', now()) - interval '6 days'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'https://x.com/emo_switch_demo/status/1900000000000000000',
    'post',
    'ready',
    1,
    timezone('utc', now()) - interval '2 days',
    timezone('utc', now()) - interval '2 days'
  )
on conflict (id) do nothing;

insert into public.generations (
  id,
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
  advice_hint,
  created_at,
  updated_at
)
values
  (
    '33333333-3333-4333-8333-333333333331',
    '11111111-1111-4111-8111-111111111111',
    '頑張ってるのに結果が出なくて、反応も鈍くてしんどい。',
    'empathy',
    70,
    'flash',
    array[
      '報われない日が続いても、今日まで積み上げた分はちゃんと明日の自分を助ける。',
      'うまくいかない日は、自分がダメなんじゃなくて、芽がまだ見えていないだけ。',
      '反応が薄い夜ほど、自分の価値まで静かになったわけじゃない。'
    ],
    array['#継続', '#発信', '#言葉の力', '#エモスイッチ'],
    0,
    128,
    '夜21時投稿。1案目をそのまま採用。',
    '高い共感トーンは夜帯と相性が良い傾向です。',
    timezone('utc', now()) - interval '5 days',
    timezone('utc', now()) - interval '5 days'
  ),
  (
    '33333333-3333-4333-8333-333333333332',
    '11111111-1111-4111-8111-111111111111',
    'やることは多いのに、結局どれも中途半端な気がする。',
    'useful',
    60,
    'pro',
    array[
      '中途半端に見える日は、優先順位を1つに絞るだけで前進の実感が戻ってくる。',
      '全部を同時に進めるより、今日終わらせる1個を決めた方が心は軽くなる。',
      '散らかったタスクは、能力不足ではなく順番待ちの渋滞かもしれない。'
    ],
    array['#タスク管理', '#仕事術', '#習慣化'],
    1,
    42,
    'ハッシュタグを3個に絞った。',
    '有益トーンは具体的な行動提案と組み合わせると保存率が伸びやすいです。',
    timezone('utc', now()) - interval '4 days',
    timezone('utc', now()) - interval '4 days'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    '最近なんか全部どうでもよく見えて、熱量が戻らない。',
    'mood',
    85,
    'flash',
    array[
      '熱が消えたんじゃない。少し長く灯りを落としていただけかもしれない。',
      '何もかも灰色に見える日は、世界ではなく心の照度が落ちているだけ。',
      '気持ちが動かない夜は、動けない自分を責める前に静けさを受け入れたい。'
    ],
    array['#情緒', '#夜の言葉', '#ひとりごと'],
    2,
    7,
    '深夜帯。3案目に変更して投稿。',
    '情緒トーンは画像や余白のあるレイアウトと組み合わせると反応差を見やすいです。',
    timezone('utc', now()) - interval '3 days',
    timezone('utc', now()) - interval '3 days'
  ),
  (
    '33333333-3333-4333-8333-333333333334',
    '11111111-1111-4111-8111-111111111111',
    '正直、努力してない人ほど文句だけ一人前に見える。',
    'toxic',
    90,
    'pro',
    array[
      '何も積まない人ほど、現実への不満だけは一流で語る。',
      '努力を笑う人は、挑戦しない自分を守る言い訳だけ上手い。',
      '口だけ達者で動かない人に、結果だけ欲しがる資格はない。'
    ],
    array['#毒舌', '#本音', '#挑戦'],
    1,
    0,
    '強すぎたかも。次は強度を下げて比較したい。',
    '毒舌トーンは刺さる一方で離脱も増えやすいので、主語を狭めると安定します。',
    timezone('utc', now()) - interval '2 days',
    timezone('utc', now()) - interval '2 days'
  ),
  (
    '33333333-3333-4333-8333-333333333335',
    '11111111-1111-4111-8111-111111111111',
    '言いたいことはあるのに、うまく短く言えない。',
    'minimal',
    40,
    'flash',
    array[
      '長い迷いは、短い一文でほどける。',
      '削るほど、本音は残る。',
      '伝わる言葉は、足すより減らす。'
    ],
    array['#短文', '#ミニマル', '#言葉選び'],
    null,
    null,
    null,
    'ミニマル案は句読点の有無でも印象が変わります。',
    timezone('utc', now()) - interval '1 day',
    timezone('utc', now()) - interval '1 day'
  )
on conflict (id) do nothing;

insert into public.credit_ledger (
  user_id,
  delta,
  reason,
  note,
  metadata,
  created_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    50,
    'free_grant',
    '初回デモ付与',
    '{"source":"seed"}'::jsonb,
    timezone('utc', now()) - interval '6 days'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    -1,
    'admin_seed',
    'デモ履歴 1',
    '{"generation_id":"33333333-3333-4333-8333-333333333331"}'::jsonb,
    timezone('utc', now()) - interval '5 days'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    -1,
    'admin_seed',
    'デモ履歴 2',
    '{"generation_id":"33333333-3333-4333-8333-333333333332"}'::jsonb,
    timezone('utc', now()) - interval '4 days'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    -1,
    'admin_seed',
    'デモ履歴 3',
    '{"generation_id":"33333333-3333-4333-8333-333333333333"}'::jsonb,
    timezone('utc', now()) - interval '3 days'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    -1,
    'admin_seed',
    'デモ履歴 4',
    '{"generation_id":"33333333-3333-4333-8333-333333333334"}'::jsonb,
    timezone('utc', now()) - interval '2 days'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    -1,
    'admin_seed',
    'デモ履歴 5',
    '{"generation_id":"33333333-3333-4333-8333-333333333335"}'::jsonb,
    timezone('utc', now()) - interval '1 day'
  )
on conflict do nothing;
