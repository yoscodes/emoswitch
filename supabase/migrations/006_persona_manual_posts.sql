alter table public.ghost_settings
  add column if not exists manual_posts text[] not null default '{}',
  add column if not exists persona_last_analyzed_hot_count integer not null default 0;

update public.ghost_settings
set
  manual_posts = case
    when coalesce(array_length(manual_posts, 1), 0) = 0 and user_id = '11111111-1111-4111-8111-111111111111'
      then array[
        '頑張ってるのに結果が出ない日は、才能よりもタイミングを疑いたい。',
        'ちゃんとしてるのに伝わらないなら、言葉より温度感がズレているのかもしれない。',
        '今日も一歩だけ進めたなら、それは止まらなかった証拠だと思う。'
      ]
    else manual_posts
  end,
  persona_last_analyzed_hot_count = case
    when persona_last_analyzed_hot_count = 0 and user_id = '11111111-1111-4111-8111-111111111111'
      then 3
    else persona_last_analyzed_hot_count
  end;
