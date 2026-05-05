/** `/api/generate-triple` の usagePurpose と一致（api-client の UsagePurpose と同じ） */
export type UsagePurposeKey = "discovery" | "blueprint" | "refinement" | "communication";

type UsagePurposePhasePlanEntry = {
  /** カード左：短い和名 */
  tileLabel: string;
  /** カード左：英字フェーズ名 */
  tilePhase: string;
  /** カード説明（1行） */
  tileSummary: string;
  /** API ワーク用途の一行ラベル */
  apiWorkPurposeOneLiner: string;
  /** 生成APIに渡す見出し */
  phaseHeadline: string;
  /** 3ステップの見出し（slotLabel・プレビューと共通） */
  stepTitles: readonly [string, string, string];
  /** 各ステップの思考手順（LLM にそのまま渡す） */
  stepInstructions: readonly [string, string, string];
  /** Lab 右カラム「作戦のプレビュー」用の一行ゴール（STEP 1〜3） */
  previewGoalByStep: readonly [string, string, string];
  protocol: {
    logicSummary: string;
    methods: string;
    detail: string;
    firstAction: string;
    finalGoal: string;
  };
};

/**
 * 活用方法ごとの「3ステップ・アクション」定義。
 * Lab UI・generate-triple の system 指示・slotLabel で同一ソースを使う。
 */
export const USAGE_PURPOSE_PHASE_PLAN: Record<UsagePurposeKey, UsagePurposePhasePlanEntry> = {
  discovery: {
    tileLabel: "探索",
    tilePhase: "Discovery",
    tileSummary: "未知の領域からヒントを拾い上げ、可能性を最大化。アイデアの種を見つける。",
    apiWorkPurposeOneLiner:
      "【ワーク用途: 探索（アイデアの種を見つける）】未知からヒントを拾い、可能性を最大化する。本命ジャンルに固執せず越境で情報源を広げ、異質結合で量を出し、直感で兆しを絞る。",
    phaseHeadline: "探索（アイデアの種を見つける）",
    stepTitles: [
      "周辺領域の「強制走査」",
      "異質な要素の「ランダム結合」",
      "直感による「兆しの選別」",
    ],
    stepInstructions: [
      "あえて本命のジャンルから2〜3歩離れた業界や技術をリサーチする。「もし農業の仕組みをWebサービスに持ち込んだら？」といった越境思考で、情報の仕入れ先を広げる。",
      "Step 1 で得た断片的なキーワードを、既存の課題と無理やり掛け合わせる。質より量を重視し、論理的にあり得ない組み合わせ（例：静かなお祭り、持ち運べる映画館など）を歓迎する。",
      "大量に出た案の中から、「なぜか気になる」「説明できないがワクワクする」という違和感や直感を基準に、3つ程度に絞り込む。",
    ],
    previewGoalByStep: [
      "越境で情報源を強制的に広げる",
      "断片を既存課題とランダム結合する",
      "直感で兆しを3案に絞る",
    ],
    protocol: {
      logicSummary: "本命から外れた領域を走査し、異質結合で量を出してから直感で絞る。",
      methods: "周辺走査 + ランダム結合 + 兆しの選別",
      detail:
        "未知の領域からヒントを拾い上げ、可能性を最大化する。越境リサーチで仕入れ先を広げ、あり得ない組み合わせを歓迎し、ワクワクする違和感で残す種を決める。",
      firstAction: "本命ジャンルと無関係な業界ニュースを3本だけ拾い、各1行で種メモに貼る。",
      finalGoal: "「なぜか気になる」案を3つに絞り、次の検証に載せる種リストとして固定する。",
    },
  },
  blueprint: {
    tileLabel: "構築",
    tilePhase: "Blueprint",
    tileSummary: "断片的なアイデアを、価値を生む「仕組み」へと昇華させる。コンセプト・新サービスを作る。",
    apiWorkPurposeOneLiner:
      "【ワーク用途: 構築（コンセプト・新サービスを作る）】断片を価値の仕組みへ昇華する。一文で価値を定義し、循環の骨格を図解し、MVP の核だけを抜き出す。",
    phaseHeadline: "構築（コンセプト・新サービスを作る）",
    stepTitles: [
      "提供価値（Value Prop）の「一文定義」",
      "ビジネスモデルの「骨格図解」",
      "最小単位の「プロトタイプ作成」",
    ],
    stepInstructions: [
      "「誰が、どんな状況で、どう幸せになるのか」を、専門用語を使わずに100文字以内で記述する。ここがブレると、後の機能盛り込みで迷走する。",
      "ユーザー、自社、パートナーの間で「お金・情報・感情」がどう循環するかを図にする。サービスの流れを可視化し、どこに無理があるかを確認する。",
      "最も核となる機能や体験だけを抽出した「MVP（実用最小限の製品）」を想定する。「これさえあれば成立する」という要素を明確にする。",
    ],
    previewGoalByStep: [
      "価値を専門用語なし一文で定義する",
      "価値・お金・感情の循環を骨格化する",
      "成立の核だけを MVP として抜く",
    ],
    protocol: {
      logicSummary: "一文で価値を固定し、循環を図解してから、成立に必要な最小核だけを抜き出す。",
      methods: "Value Prop 一文 + 骨格図解 + MVP 核",
      detail:
        "断片的なアイデアを価値の仕組みへ昇華する。誰のどんな状況の幸福かを言語化し、ステークホルダー間の循環を可視化し、これさえあれば成立する要素を絞る。",
      firstAction: "価値命題を専門用語なしで100文字以内の1文に書き、種メモの先頭に置く。",
      finalGoal: "循環の骨格と MVP の核が一貫したセットとして言える状態にする。",
    },
  },
  refinement: {
    tileLabel: "研磨",
    tilePhase: "Refinement",
    tileSummary: "作ったコンセプトを現実に即して削り出し、精度を上げる。顧客解像度とディテールを高める。",
    apiWorkPurposeOneLiner:
      "【ワーク用途: 研磨（顧客解像度・ディテールを高める）】コンセプトを現実に即して削る。24時間憑依、ネガ視点の破壊テスト、情緒ベネフィットの言語化で解像度を上げる。",
    phaseHeadline: "研磨（顧客解像度・ディテールを高める）",
    stepTitles: [
      "ターゲットへの「憑依インタビュー」",
      "アンチパターンの「破壊テスト」",
      "情緒的ベネフィットの「言語化」",
    ],
    stepInstructions: [
      "想定顧客の1日24時間を分単位で想像し、その中での不満や喜びを書き出す。可能であれば実際のターゲットに「今の生活で何が一番面倒か」を深く聞き込む。",
      "「なぜこのサービスは使われないのか？」「競合に勝てない理由は何か？」と、あえてネガティブな視点で攻撃する。見つかった弱点を補強することで、解像度が高まる。",
      "「便利」の先にある「安心感」や「優越感」など、顧客が心の底で求めている感情的な報酬を特定し、サービス設計に反映させる。",
    ],
    previewGoalByStep: [
      "1日を憑依して不満・喜びを書き出す",
      "使われない理由をネガ視点で洗う",
      "情緒的報酬を言語化して設計に反映する",
    ],
    protocol: {
      logicSummary: "24時間憑依で生活文脈を埋め、破壊テストで穴を開け、情緒報酬まで言語化する。",
      methods: "憑依インタビュー + 破壊テスト + 情緒ベネフィット",
      detail:
        "作ったコンセプトを現実に即して削る。分単位の生活導線、ネガシナリオでの弱点、心の底の感情的報酬まで解像度を上げる。",
      firstAction: "想定顧客の「今日の朝から就寝まで」を箇条書きで15行以内にし、面倒な瞬間に印をつける。",
      finalGoal: "主要なアンチパターンと情緒ベネフィットが言語化され、次の打ち手に落とせる状態にする。",
    },
  },
  communication: {
    tileLabel: "伝達",
    tilePhase: "Communication",
    tileSummary: "価値を相手の脳内に一瞬で突き刺す。キャッチコピー・表現を磨く。",
    apiWorkPurposeOneLiner:
      "【ワーク用途: 伝達（キャッチコピー・表現を磨く）】価値を一瞬で脳内に刺す。日常語への翻訳、ビフォーアフターのギャップ、消費コンテキストへの最適化で磨く。",
    phaseHeadline: "伝達（キャッチコピー・表現を磨く）",
    stepTitles: [
      "専門用語の「日常語翻訳」",
      "ビフォーアフターの「ギャップ演出」",
      "文脈（コンテキスト）への「最適化」",
    ],
    stepInstructions: [
      "自分たちの強みを、小学生でもわかる言葉に置き換える。「高効率なアルゴリズム」を「待ち時間がゼロになる魔法」と言い換えるような作業をする。",
      "「これを使わない時の不幸」と「使った後の幸福」の差を際立たせる。現状への不満を代弁し、その解決策としてアイデアを提示する構造を作る。",
      "SNSで見るのか、看板で見るのか、商談で聞くのか。そのメッセージが消費される「場所」に合わせて、語気や長さを調整する。一言で言えば「誰が、どこで聞くか」に合わせる作業をする。",
    ],
    previewGoalByStep: [
      "強みを日常語・比喩で翻訳する",
      "不幸と幸福のギャップを代弁する",
      "チャネル別に語気と長さを最適化する",
    ],
    protocol: {
      logicSummary: "専門語を日常語に落とし、ギャップで刺し、消費される場に合わせて整形する。",
      methods: "日常語翻訳 + ギャップ演出 + コンテキスト最適化",
      detail:
        "価値を相手の脳内に一瞬で突き刺す。置き換えた言葉、ビフォーアフター、誰がどこで受け取るかまでを揃える。",
      firstAction: "自社の強みを専門用語で1行書き、その直下に小学生向けの言い換えを1行だけ足す。",
      finalGoal: "チャネルごとに最適化したコピー案が揃い、一言で価値と文脈が説明できる状態にする。",
    },
  },
};

export function getUsagePurposeStepRoleLines(usagePurpose: UsagePurposeKey): readonly string[] {
  return [...USAGE_PURPOSE_PHASE_PLAN[usagePurpose].stepTitles];
}

export function getUsagePurposePreviewGoalByStep(usagePurpose: UsagePurposeKey): readonly [string, string, string] {
  return USAGE_PURPOSE_PHASE_PLAN[usagePurpose].previewGoalByStep;
}

/** API system に渡す 3STEP 詳細ブロック（slotKey と対応付け） */
export function buildUsagePurposeStepPlanPromptBlock(usagePurpose: UsagePurposeKey): string {
  const plan = USAGE_PURPOSE_PHASE_PLAN[usagePurpose];
  const [t0, t1, t2] = plan.stepTitles;
  const [d0, d1, d2] = plan.stepInstructions;
  return [
    `【現在のフェーズ：${plan.phaseHeadline}】${plan.tileSummary}`,
    "以下の思考フレームワークに厳密に従い、items の3件（STEP1→3）で検証アクションを設計すること。",
    "【出力の意味づけ】各 item について、(1) body の叙述部はそのステップの意図（なぜこれをするのか）と検証の狙いを述べ、(2) immediateAction と body 末尾の所定マーク行は、後述の極小・安全制約に従う具体To-Doに限定する。",
    "items は必ず3件。slotKey は順に mon_problem → wed_solution → fri_emotion（保存用の内部ラベル。本文の役割は下記STEPの和文にのみ従い、英語キー連想に引っ張らない）。",
    `STEP 1（slotKey=mon_problem）「${t0}」: ${d0}`,
    `STEP 2（slotKey=wed_solution）「${t1}」: ${d1}`,
    `STEP 3（slotKey=fri_emotion）「${t2}」: ${d2}`,
    "3本は同一テーマ上の連続ステップであり、互いに無関係な別案にしてはならない。",
  ].join("\n");
}

/** 保存用・UI表示用の slotLabel（STEP 番号 + 役割の短名） */
export function buildSeriesSlotLabelForPurpose(
  usagePurpose: UsagePurposeKey,
  slotKey: "mon_problem" | "wed_solution" | "fri_emotion",
): string {
  const order: Array<"mon_problem" | "wed_solution" | "fri_emotion"> = ["mon_problem", "wed_solution", "fri_emotion"];
  const index = order.indexOf(slotKey);
  const role = USAGE_PURPOSE_PHASE_PLAN[usagePurpose].stepTitles[index] ?? "";
  return `STEP ${index + 1} | ${role}`;
}
