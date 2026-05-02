-- Seed pivot-native Vault samples (hypotheses + vault_logs)
-- This migration inserts sample records that are directly consumed by /vault
-- after the pivot (legacy_source_type is intentionally NULL).

with target_user as (
  select id
  from (
    select id, 0 as priority, created_at
    from public.profiles
    where is_demo = true
    union all
    select id, 1 as priority, created_at
    from public.profiles
  ) ranked
  order by priority asc, created_at desc
  limit 1
),
single_hypotheses as (
  insert into public.hypotheses (
    id,
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
    sample.id,
    u.id,
    null,
    null,
    'single',
    sample.seed_input,
    sample.strategy_params::jsonb,
    sample.identity_snapshot::jsonb,
    sample.output_content::jsonb,
    'deployed',
    sample.created_at,
    sample.created_at,
    sample.created_at,
    null
  from target_user u
  cross join (
    values
      (
        '90000000-0000-4000-8000-000000000001'::uuid,
        '30代フリーランス向けに、提案書作成を半自動化するAIアシスタントの価値訴求を検証したい。',
        '{"emotion":"useful","intensity":62,"speed_mode":"pro"}',
        '{"version":2,"current_prophecy":"課題発見型の実装者","dna_completeness":76}',
        '{
          "variants":[
            "提案書づくりで一番削れるのは、文章力より「考える順番」です。5分で骨子を出せるだけで、商談準備の体感は変わります。",
            "提案書が遅れる原因は、書く前の整理不足。先に論点を並べるだけで、作成時間は半分にできます。",
            "提案書が進まない日は、やる気ではなく構成が足りない。最初の10分を設計に使うだけで、残り50分が軽くなります。"
          ],
          "hashtags":["#提案書作成","#業務効率化","#フリーランス営業"],
          "selected_index":0,
          "advice_hint":"具体的な削減時間を先に示すと保存率が上がる傾向です。",
          "memory_tags":["順番設計","時短訴求","再現性"]
        }',
        timezone('utc', now()) - interval '3 day'
      ),
      (
        '90000000-0000-4000-8000-000000000002'::uuid,
        '創業期チーム向けに、週次ふりかえりテンプレートの必要性を伝える訴求を試したい。',
        '{"emotion":"empathy","intensity":55,"speed_mode":"flash"}',
        '{"version":2,"current_prophecy":"共感から導く伴走者","dna_completeness":73}',
        '{
          "variants":[
            "忙しい週ほど振り返れない。でも、振り返らない週ほど同じミスが増える。5分の棚卸しが来週の余白を作ります。",
            "前に進めない感覚の正体は、努力不足より「整理不足」。週1で言語化するだけで、次の一手が見えます。",
            "チームが噛み合わない週は、能力より認識がズレているだけ。共通のふりかえり軸があると空中戦が減ります。"
          ],
          "hashtags":["#スタートアップ","#週次振り返り","#チーム運営"],
          "selected_index":1,
          "advice_hint":"共感トーンは失敗体験→小さな解決の順で反応が安定します。",
          "memory_tags":["共感導入","問題言語化"]
        }',
        timezone('utc', now()) - interval '2 day'
      )
  ) as sample(id, seed_input, strategy_params, identity_snapshot, output_content, created_at)
  on conflict (id) do nothing
  returning id, user_id
),
series_hypotheses as (
  insert into public.hypotheses (
    id,
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
    sample.id,
    u.id,
    null,
    null,
    'series',
    sample.seed_input,
    sample.strategy_params::jsonb,
    sample.identity_snapshot::jsonb,
    sample.output_content::jsonb,
    'deployed',
    sample.created_at,
    sample.created_at,
    sample.created_at,
    null
  from target_user u
  cross join (
    values
      (
        '90000000-0000-4000-8000-000000000003'::uuid,
        '中小企業の採用広報を改善するため、3投稿で価値訴求を検証する。',
        '{"emotion":"useful","intensity":58,"speed_mode":"pro","title":"採用広報の詰まりを解消する3フェーズ"}',
        '{"version":2,"current_prophecy":"価値を構造化する編集者","dna_completeness":81}',
        '{
          "title":"採用広報の詰まりを解消する3フェーズ",
          "advice_hint":"課題提示→再定義→感情フックの順が継続読了率を押し上げます。",
          "ghost_whisper":"過去ログでは、具体的な現場描写がある投稿ほど保存率が高い傾向です。",
          "memory_tags":["課題再定義","現場描写","実装導線"],
          "items":[
            {
              "id":"90000000-0000-4000-8000-100000000001",
              "slot_key":"mon_problem",
              "slot_label":"月曜：課題提示",
              "body":"応募が来ない原因は、母集団不足だけじゃない。候補者が『入社後の自分』を想像できないことが多い。",
              "hashtags":["#採用広報","#人事","#採用戦略"],
              "quick_feedback":null,
              "likes":null,
              "memo":null,
              "memory_tags":["課題提示"]
            },
            {
              "id":"90000000-0000-4000-8000-100000000002",
              "slot_key":"wed_solution",
              "slot_label":"水曜：解決案",
              "body":"まずは1投稿1メッセージ。制度説明より、現場の1日の流れを可視化すると応募前の不安が減る。",
              "hashtags":["#採用広報","#採用ブランディング","#中小企業"],
              "quick_feedback":null,
              "likes":null,
              "memo":null,
              "memory_tags":["具体化","不安解消"]
            },
            {
              "id":"90000000-0000-4000-8000-100000000003",
              "slot_key":"fri_emotion",
              "slot_label":"金曜：感情接続",
              "body":"『来てほしい人』を語る前に、『一緒に働きたい理由』を語る。最後は条件より熱量が届く。",
              "hashtags":["#採用","#組織づくり","#経営"],
              "quick_feedback":null,
              "likes":null,
              "memo":null,
              "memory_tags":["感情接続","余韻締め"]
            }
          ]
        }',
        timezone('utc', now()) - interval '1 day'
      )
  ) as sample(id, seed_input, strategy_params, identity_snapshot, output_content, created_at)
  on conflict (id) do nothing
  returning id, user_id
)
insert into public.vault_logs (
  id,
  user_id,
  hypothesis_id,
  reaction_type,
  sentiment_score,
  reaction_payload,
  is_synced_to_roots,
  synced_at,
  created_at,
  updated_at
)
select
  sample.id,
  u.id,
  sample.hypothesis_id,
  sample.reaction_type,
  sample.sentiment_score,
  sample.reaction_payload::jsonb,
  false,
  null,
  sample.created_at,
  sample.created_at
from target_user u
cross join (
  values
    (
      '91000000-0000-4000-8000-000000000001'::uuid,
      '90000000-0000-4000-8000-000000000001'::uuid,
      'hot',
      0.84::double precision,
      '{"source":"seed_pivot_sample"}',
      timezone('utc', now()) - interval '2 day'
    ),
    (
      '91000000-0000-4000-8000-000000000002'::uuid,
      '90000000-0000-4000-8000-000000000001'::uuid,
      'feedback',
      null::double precision,
      '{"source":"seed_pivot_sample","likes":124}',
      timezone('utc', now()) - interval '2 day'
    ),
    (
      '91000000-0000-4000-8000-000000000003'::uuid,
      '90000000-0000-4000-8000-000000000001'::uuid,
      'memo',
      null::double precision,
      '{"source":"seed_pivot_sample","memo":"CTAを末尾に寄せた版が保存されやすかった。"}',
      timezone('utc', now()) - interval '2 day'
    ),
    (
      '91000000-0000-4000-8000-000000000004'::uuid,
      '90000000-0000-4000-8000-000000000002'::uuid,
      'cold',
      -0.31::double precision,
      '{"source":"seed_pivot_sample"}',
      timezone('utc', now()) - interval '1 day'
    ),
    (
      '91000000-0000-4000-8000-000000000005'::uuid,
      '90000000-0000-4000-8000-000000000002'::uuid,
      'memo',
      null::double precision,
      '{"source":"seed_pivot_sample","memo":"課題の粒度が広すぎたので業界別に分けて再検証予定。"}',
      timezone('utc', now()) - interval '1 day'
    ),
    (
      '91000000-0000-4000-8000-000000000006'::uuid,
      '90000000-0000-4000-8000-000000000003'::uuid,
      'hot',
      0.66::double precision,
      '{"source":"seed_pivot_sample"}',
      timezone('utc', now()) - interval '20 hour'
    ),
    (
      '91000000-0000-4000-8000-000000000007'::uuid,
      '90000000-0000-4000-8000-000000000003'::uuid,
      'hot',
      0.78::double precision,
      '{"source":"seed_pivot_sample","series_item_id":"90000000-0000-4000-8000-100000000001","slot_key":"mon_problem"}',
      timezone('utc', now()) - interval '18 hour'
    ),
    (
      '91000000-0000-4000-8000-000000000008'::uuid,
      '90000000-0000-4000-8000-000000000003'::uuid,
      'feedback',
      null::double precision,
      '{"source":"seed_pivot_sample","series_item_id":"90000000-0000-4000-8000-100000000001","slot_key":"mon_problem","likes":96}',
      timezone('utc', now()) - interval '18 hour'
    ),
    (
      '91000000-0000-4000-8000-000000000009'::uuid,
      '90000000-0000-4000-8000-000000000003'::uuid,
      'cold',
      -0.22::double precision,
      '{"source":"seed_pivot_sample","series_item_id":"90000000-0000-4000-8000-100000000002","slot_key":"wed_solution"}',
      timezone('utc', now()) - interval '12 hour'
    ),
    (
      '91000000-0000-4000-8000-000000000010'::uuid,
      '90000000-0000-4000-8000-000000000003'::uuid,
      'memo',
      null::double precision,
      '{"source":"seed_pivot_sample","series_item_id":"90000000-0000-4000-8000-100000000003","slot_key":"fri_emotion","memo":"金曜投稿は経営者の実体験を追記すると伸びた。"}',
      timezone('utc', now()) - interval '8 hour'
    )
) as sample(id, hypothesis_id, reaction_type, sentiment_score, reaction_payload, created_at)
on conflict (id) do nothing;
