import type { UsagePurpose } from "@/lib/api-client";

export type StructuredSheetSlotHint = {
  /** ラベル直下の一言（用途に合わせた意味づけ） */
  hint: string;
  /** 例文（そのまま表示） */
  example: string;
  /** 入力欄プレースホルダ */
  placeholder: string;
};

export type StructuredSheetHints = {
  sheetIntro: string;
  /** ①ラベル直下の括弧補助（PHASE に応じた視点） */
  audienceSubline?: string;
  audience: StructuredSheetSlotHint;
  pain: StructuredSheetSlotHint;
  firstExperiment: StructuredSheetSlotHint;
  whyNow: StructuredSheetSlotHint;
};

const COMMON = {
  audienceLabel: "① 誰に？（行動ベースで絞る）",
  painLabel: "② どんな悩み？（すでに解決行動してるかまで見る）",
  experimentLabel: "③ どんな価値をどうやって手動で届ける？（48時間以内）",
  whyNowLabel: "④ なぜ今やるのか？（緊急性）",
} as const;

export const STRUCTURED_SHEET_LABELS = COMMON;

export const STRUCTURED_SHEET_HINTS_BY_PURPOSE: Record<UsagePurpose, StructuredSheetHints> = {
  discovery: {
    sheetIntro:
      "探索では「種」「不」「最小接触」の三个人視点で、ニーズの入口を広げつつ反応を取りにいきます。",
    audienceSubline: "（まだ見ぬニーズを持つ人）",
    audience: {
      hint: "ニーズの「種」を特定する（誰の、どんな迷いの芽か）",
      example: "副業に興味はあるが、何が自分に向いているか全く見当がつかない人",
      placeholder: "例: 副業に興味はあるが、何が自分に向いているか全く見当がつかない人",
    },
    pain: {
      hint: "未知の「不」をあぶり出す（言語化しづらい違和感・閉塞感）",
      example: "今の生活に不満はないが、将来への漠然とした閉塞感がある",
      placeholder: "例: 今の生活に不満はないが、将来への漠然とした閉塞感がある",
    },
    firstExperiment: {
      hint: "反応を見るための最小の接触方法（手間とリスクを最小に）",
      example: "Xで「今の悩み」を1行だけ募集し、DMで壁打ち相手になる",
      placeholder: "例: Xで「今の悩み」を1行だけ募集し、DMで壁打ち相手になる",
    },
    whyNow: {
      hint: "いま動かすと「気づきの鮮度」や偶然の反応を拾いやすい理由",
      example: "気持ちが冷める前に、小さな反応のログを1つでも残したい",
      placeholder: "例: 気持ちが冷める前に、小さな反応のログを1つでも残したい",
    },
  },
  blueprint: {
    sheetIntro:
      "構築では「主役」「痛み」「核（MVP）」を揃え、売れるストーリーと最初の提示物を組み立てます。",
    audienceSubline: "（価値を受け取る主役）",
    audience: {
      hint: "価値を受け取る「主役」を決める（誰が一番うれしいか）",
      example: "note発信はしているが、マネタイズの導線が作れず足踏みしている40代",
      placeholder: "例: note発信はしているが、マネタイズの導線が作れず足踏みしている40代",
    },
    pain: {
      hint: "解決すべき「具体的な痛み」（いま止まっている一点）",
      example: "ネタはあるのに投稿が続かず、自分の価値をどう売ればいいかわからない",
      placeholder: "例: ネタはあるのに投稿が続かず、自分の価値をどう売ればいいかわからない",
    },
    firstExperiment: {
      hint: "プロダクトの核（MVP）の提示（48時間で見せられる最小セット）",
      example: "有料noteの目次案と、購入後のベネフィットをセットで提示する",
      placeholder: "例: 有料noteの目次案と、購入後のベネフィットをセットで提示する",
    },
    whyNow: {
      hint: "コンセプトを先に固めないと、発信・商品がバラけるリスクがある理由",
      example: "企画が増えすぎて、どれも中途半端になる前に核を一本化したい",
      placeholder: "例: 企画が増えすぎて、どれも中途半端になる前に核を一本化したい",
    },
  },
  refinement: {
    sheetIntro:
      "研磨では「誰を精度上げる対象にするか」「なぜ解決しないか」「反証」で仮説を圧縮します。",
    audienceSubline: "（検証精度を上げる対象）",
    audience: {
      hint: "検証の「精度」を上げる対象（いちばんズレを潰したい相手像）",
      example: "既存の副業講座は試したが、結局どれも継続できなかった挫折経験者",
      placeholder: "例: 既存の副業講座は試したが、結局どれも継続できなかった挫折経験者",
    },
    pain: {
      hint: "「なぜ解決しないか」の深掘り（ノウハウ以外の壁）",
      example: "ノウハウはわかったが、孤独な作業に耐えられず挫折する構造的課題",
      placeholder: "例: ノウハウはわかったが、孤独な作業に耐えられず挫折する構造的課題",
    },
    firstExperiment: {
      hint: "逃げ場をなくす「反証」の提示（誰に向けないか・捨てる前提）",
      example: "あえて「〇〇な人には向きません」と断言し、価値を鋭角にする",
      placeholder: "例: あえて「〇〇な人には向きません」と断言し、価値を鋭角にする",
    },
    whyNow: {
      hint: "この前提のまま進むと、また同じ壁で止まりそうな理由",
      example: "次の打ち手を決める前に、ズレている前提だけは潰しておきたい",
      placeholder: "例: 次の打ち手を決める前に、ズレている前提だけは潰しておきたい",
    },
  },
  communication: {
    sheetIntro:
      "伝達では「届け先」「感情トリガー」「フックとCTA」で、短く刺さる一言と行動を設計します。",
    audienceSubline: "（今すぐ届けるべき実在の顧客）",
    audience: {
      hint: "「今すぐ」届けたい相手（心の状態まで）",
      example: "上司の顔色を伺う毎日に疲れ、週末だけは「自分」を取り戻したい人",
      placeholder: "例: 上司の顔色を伺う毎日に疲れ、週末だけは「自分」を取り戻したい人",
    },
    pain: {
      hint: "感情が動く「トリガー」（きっかけの情景）",
      example: "スマホを見るたびに胃が痛くなる、職場での心理的プレッシャー",
      placeholder: "例: スマホを見るたびに胃が痛くなる、職場での心理的プレッシャー",
    },
    firstExperiment: {
      hint: "記憶に残る「フック」とCTA（48時間で試せる一文＋導線）",
      example: "1行目に「上司のLINEに怯えない人生へ」と置いた広告文とリンク",
      placeholder: "例: 1行目に「上司のLINEに怯えない人生へ」と置いた広告文とリンク",
    },
    whyNow: {
      hint: "「打つなら今」の期限・機会・感情のピークがある理由",
      example: "キャンペーン期限が迫っている／同じ悩みの声が今だけ集まっている",
      placeholder: "例: キャンペーン期限が迫っている／同じ悩みの声が今だけ集まっている",
    },
  },
};

export function getStructuredSheetHints(purpose: UsagePurpose): StructuredSheetHints {
  return STRUCTURED_SHEET_HINTS_BY_PURPOSE[purpose] ?? STRUCTURED_SHEET_HINTS_BY_PURPOSE.discovery;
}
