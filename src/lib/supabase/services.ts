import type { User } from "@supabase/supabase-js";
import type { EmotionTone } from "@/lib/emotions";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { CreditSummary, GenerationRecord, GhostSettings, UserProfileSettings } from "@/lib/types";

export const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_USER_EMAIL = "demo@emoswitch.local";
const DEMO_USER_PASSWORD = "EmoSwitchDemo#2026";
const DEMO_DISPLAY_NAME = "デモユーザー";

type DbGenerationRow = {
  id: string;
  created_at: string;
  draft: string;
  emotion: EmotionTone;
  intensity: number;
  speed_mode: "flash" | "pro" | null;
  variants: string[];
  hashtags: string[];
  selected_index: number | null;
  likes: number | null;
  memo: string | null;
  advice_hint: string | null;
  deleted_at: string | null;
};

type GenerationCreateInput = Omit<GenerationRecord, "id" | "createdAt">;

type GenerationUpdateInput = Partial<Pick<GenerationRecord, "selectedIndex" | "likes" | "memo">>;

type LocalMigrationPayload = {
  generations: GenerationRecord[];
  ghostSettings: GhostSettings;
};

const DEFAULT_GHOST_SETTINGS: GhostSettings = {
  profileUrl: "",
  ngWords: [],
};

const DEMO_GENERATIONS: Array<{
  id: string;
  draft: string;
  emotion: EmotionTone;
  intensity: number;
  speed_mode: "flash" | "pro";
  variants: string[];
  hashtags: string[];
  selected_index: number | null;
  likes: number | null;
  memo: string | null;
  advice_hint: string | null;
  created_at: string;
}> = [
  {
    id: "33333333-3333-4333-8333-333333333331",
    draft: "頑張ってるのに結果が出なくて、反応も鈍くてしんどい。",
    emotion: "empathy",
    intensity: 70,
    speed_mode: "flash",
    variants: [
      "報われない日が続いても、今日まで積み上げた分はちゃんと明日の自分を助ける。",
      "うまくいかない日は、自分がダメなんじゃなくて、芽がまだ見えていないだけ。",
      "反応が薄い夜ほど、自分の価値まで静かになったわけじゃない。",
    ],
    hashtags: ["#継続", "#発信", "#言葉の力", "#エモスイッチ"],
    selected_index: 0,
    likes: 128,
    memo: "夜21時投稿。1案目をそのまま採用。",
    advice_hint: "高い共感トーンは夜帯と相性が良い傾向です。",
    created_at: isoDaysAgo(5),
  },
  {
    id: "33333333-3333-4333-8333-333333333332",
    draft: "やることは多いのに、結局どれも中途半端な気がする。",
    emotion: "useful",
    intensity: 60,
    speed_mode: "pro",
    variants: [
      "中途半端に見える日は、優先順位を1つに絞るだけで前進の実感が戻ってくる。",
      "全部を同時に進めるより、今日終わらせる1個を決めた方が心は軽くなる。",
      "散らかったタスクは、能力不足ではなく順番待ちの渋滞かもしれない。",
    ],
    hashtags: ["#タスク管理", "#仕事術", "#習慣化"],
    selected_index: 1,
    likes: 42,
    memo: "ハッシュタグを3個に絞った。",
    advice_hint: "有益トーンは具体的な行動提案と組み合わせると保存率が伸びやすいです。",
    created_at: isoDaysAgo(4),
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    draft: "最近なんか全部どうでもよく見えて、熱量が戻らない。",
    emotion: "mood",
    intensity: 85,
    speed_mode: "flash",
    variants: [
      "熱が消えたんじゃない。少し長く灯りを落としていただけかもしれない。",
      "何もかも灰色に見える日は、世界ではなく心の照度が落ちているだけ。",
      "気持ちが動かない夜は、動けない自分を責める前に静けさを受け入れたい。",
    ],
    hashtags: ["#情緒", "#夜の言葉", "#ひとりごと"],
    selected_index: 2,
    likes: 7,
    memo: "深夜帯。3案目に変更して投稿。",
    advice_hint: "情緒トーンは画像や余白のあるレイアウトと組み合わせると反応差を見やすいです。",
    created_at: isoDaysAgo(3),
  },
  {
    id: "33333333-3333-4333-8333-333333333334",
    draft: "正直、努力してない人ほど文句だけ一人前に見える。",
    emotion: "toxic",
    intensity: 90,
    speed_mode: "pro",
    variants: [
      "何も積まない人ほど、現実への不満だけは一流で語る。",
      "努力を笑う人は、挑戦しない自分を守る言い訳だけ上手い。",
      "口だけ達者で動かない人に、結果だけ欲しがる資格はない。",
    ],
    hashtags: ["#毒舌", "#本音", "#挑戦"],
    selected_index: 1,
    likes: 0,
    memo: "強すぎたかも。次は強度を下げて比較したい。",
    advice_hint: "毒舌トーンは刺さる一方で離脱も増えやすいので、主語を狭めると安定します。",
    created_at: isoDaysAgo(2),
  },
  {
    id: "33333333-3333-4333-8333-333333333335",
    draft: "言いたいことはあるのに、うまく短く言えない。",
    emotion: "minimal",
    intensity: 40,
    speed_mode: "flash",
    variants: ["長い迷いは、短い一文でほどける。", "削るほど、本音は残る。", "伝わる言葉は、足すより減らす。"],
    hashtags: ["#短文", "#ミニマル", "#言葉選び"],
    selected_index: null,
    likes: null,
    memo: null,
    advice_hint: "ミニマル案は句読点の有無でも印象が変わります。",
    created_at: isoDaysAgo(1),
  },
];

const DEMO_GHOST_SOURCES = [
  {
    id: "22222222-2222-4222-8222-222222222221",
    source_url: "https://x.com/emo_switch_demo",
    source_type: "profile",
    status: "ready",
    imported_post_count: 28,
    created_at: isoDaysAgo(6),
    updated_at: isoDaysAgo(6),
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    source_url: "https://x.com/emo_switch_demo/status/1900000000000000000",
    source_type: "post",
    status: "ready",
    imported_post_count: 1,
    created_at: isoDaysAgo(2),
    updated_at: isoDaysAgo(2),
  },
] as const;

type AppActor = {
  userId: string;
  mode: "auth" | "demo";
};

type DbProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  default_emotion: EmotionTone;
  writing_style: "polite" | "casual" | "passionate";
  sentence_style: "desumasu" | "friendly";
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function mapGeneration(row: DbGenerationRow): GenerationRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    draft: row.draft,
    emotion: row.emotion,
    intensity: row.intensity,
    speedMode: row.speed_mode ?? undefined,
    variants: row.variants ?? [],
    hashtags: row.hashtags ?? [],
    selectedIndex: row.selected_index,
    likes: row.likes,
    memo: row.memo,
    adviceHint: row.advice_hint,
  };
}

function getUserDisplayName(user: User): string | null {
  const metadata = user.user_metadata;
  const candidates = [
    metadata?.full_name,
    metadata?.name,
    metadata?.display_name,
    user.email?.split("@")[0],
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

async function requireProfileRow(userId: string): Promise<DbProfileRow> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, display_name, default_emotion, writing_style, sentence_style")
    .eq("id", userId)
    .single<DbProfileRow>();

  if (error) {
    throw error;
  }

  return data;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

async function ensureAuthenticatedUser(user: User): Promise<string> {
  const userId = user.id;
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email: user.email ?? `${userId}@users.emoswitch.local`,
      display_name: getUserDisplayName(user),
      is_demo: false,
    },
    { onConflict: "id" },
  );

  if (profileError) throw profileError;

  return userId;
}

async function requireGenerationById(id: string, userId?: string): Promise<GenerationRecord> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select(
      "id, created_at, draft, emotion, intensity, speed_mode, variants, hashtags, selected_index, likes, memo, advice_hint, deleted_at",
    )
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null)
    .single<DbGenerationRow>();

  if (error) {
    throw error;
  }

  return mapGeneration(data);
}

export async function ensureDemoUser(): Promise<string> {
  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    id: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    password: DEMO_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: DEMO_DISPLAY_NAME, is_demo: true },
    app_metadata: { provider: "email", providers: ["email"] },
  });

  if (createError && !/already registered|already exists|duplicate/i.test(createError.message)) {
    throw createError;
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      display_name: DEMO_DISPLAY_NAME,
      is_demo: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw profileError;
  }

  return DEMO_USER_ID;
}

export async function bootstrapDemoWorkspace(): Promise<{ userId: string; seeded: boolean }> {
  const userId = await ensureDemoUser();

  const [
    { count: generationCount, error: generationCountError },
    { count: ledgerCount, error: ledgerCountError },
    { count: sourceCount, error: sourceCountError },
    { count: ghostSettingsCount, error: ghostSettingsCountError },
  ] =
    await Promise.all([
      supabaseAdmin
        .from("generations")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", userId)
        .is("deleted_at", null),
      supabaseAdmin.from("credit_ledger").select("id", { head: true, count: "exact" }).eq("user_id", userId),
      supabaseAdmin
        .from("ghost_sources")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", userId)
        .is("deleted_at", null),
      supabaseAdmin.from("ghost_settings").select("user_id", { head: true, count: "exact" }).eq("user_id", userId),
    ]);

  if (generationCountError) throw generationCountError;
  if (ledgerCountError) throw ledgerCountError;
  if (sourceCountError) throw sourceCountError;
  if (ghostSettingsCountError) throw ghostSettingsCountError;

  const seeded = (generationCount ?? 0) === 0;

  if (seeded) {
    const { error: generationInsertError } = await supabaseAdmin.from("generations").insert(
      DEMO_GENERATIONS.map((row) => ({
        ...row,
        user_id: userId,
        updated_at: row.created_at,
      })),
    );

    if (generationInsertError) {
      throw generationInsertError;
    }
  }

  if ((sourceCount ?? 0) === 0) {
    const { error: sourceInsertError } = await supabaseAdmin.from("ghost_sources").insert(
      DEMO_GHOST_SOURCES.map((row) => ({
        ...row,
        user_id: userId,
      })),
    );

    if (sourceInsertError) {
      throw sourceInsertError;
    }
  }

  if ((ledgerCount ?? 0) === 0) {
    const demoLedger = [
      {
        user_id: userId,
        delta: 50,
        reason: "free_grant",
        note: "初回デモ付与",
        metadata: { source: "bootstrap" },
        created_at: isoDaysAgo(6),
      },
      ...DEMO_GENERATIONS.map((row, index) => ({
        user_id: userId,
        delta: -1,
        reason: "admin_seed",
        note: `デモ履歴 ${index + 1}`,
        metadata: { generation_id: row.id },
        created_at: row.created_at,
      })),
    ];

    const { error: ledgerInsertError } = await supabaseAdmin.from("credit_ledger").insert(demoLedger);

    if (ledgerInsertError) {
      throw ledgerInsertError;
    }
  }

  if ((ghostSettingsCount ?? 0) === 0) {
    const { error: ghostSettingsError } = await supabaseAdmin.from("ghost_settings").insert({
      user_id: userId,
      profile_url: "https://x.com/emo_switch_demo",
      ng_words: ["炎上", "上から目線", "マジで"],
    });

    if (ghostSettingsError) {
      throw ghostSettingsError;
    }
  }

  return { userId, seeded };
}

export async function resolveRequestActor(request: Request): Promise<AppActor> {
  const token = getBearerToken(request);

  if (!token) {
    const { userId } = await bootstrapDemoWorkspace();
    return { userId, mode: "demo" };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new Error("認証ユーザーの取得に失敗しました");
  }

  const userId = await ensureAuthenticatedUser(user);
  return { userId, mode: "auth" };
}

export async function requireAuthenticatedUserFromRequest(request: Request): Promise<User> {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("ログインが必要です");
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new Error("認証ユーザーの取得に失敗しました");
  }

  await ensureAuthenticatedUser(user);
  return user;
}

async function resolveScopedUserId(userId?: string): Promise<string> {
  return userId ?? (await ensureDemoUser());
}

export async function listGenerations(userId?: string): Promise<GenerationRecord[]> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select(
      "id, created_at, draft, emotion, intensity, speed_mode, variants, hashtags, selected_index, likes, memo, advice_hint, deleted_at",
    )
    .eq("user_id", scopedUserId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .overrideTypes<DbGenerationRow[]>();

  if (error) {
    throw error;
  }

  return data.map(mapGeneration);
}

export async function createGeneration(
  input: GenerationCreateInput,
  userId?: string,
): Promise<GenerationRecord> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin.rpc("create_generation_with_credit", {
    p_user_id: scopedUserId,
    p_draft: input.draft,
    p_emotion: input.emotion,
    p_intensity: input.intensity,
    p_speed_mode: input.speedMode ?? null,
    p_variants: input.variants,
    p_hashtags: input.hashtags,
    p_selected_index: input.selectedIndex,
    p_likes: input.likes,
    p_memo: input.memo,
    p_advice_hint: input.adviceHint,
  });

  if (error) {
    if (/NO_CREDITS_REMAINING/.test(error.message)) {
      throw new Error("クレジットが残っていません。");
    }
    throw error;
  }

  return requireGenerationById(String(data), scopedUserId);
}

export async function updateGeneration(
  id: string,
  patch: GenerationUpdateInput,
  userId?: string,
): Promise<GenerationRecord> {
  const scopedUserId = await resolveScopedUserId(userId);
  const updatePayload: Record<string, number | string | null> = {};

  if (patch.selectedIndex !== undefined) updatePayload.selected_index = patch.selectedIndex;
  if (patch.likes !== undefined) updatePayload.likes = patch.likes;
  if (patch.memo !== undefined) updatePayload.memo = patch.memo;

  const { error } = await supabaseAdmin
    .from("generations")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  return requireGenerationById(id, scopedUserId);
}

export async function softDeleteGeneration(id: string, userId?: string): Promise<void> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { error } = await supabaseAdmin
    .from("generations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", scopedUserId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
}

export async function getGhostSettings(userId?: string): Promise<GhostSettings> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("ghost_settings")
    .select("profile_url, ng_words")
    .eq("user_id", scopedUserId)
    .single<{ profile_url: string; ng_words: string[] }>();

  if (error) {
    return DEFAULT_GHOST_SETTINGS;
  }

  return {
    profileUrl: data.profile_url ?? "",
    ngWords: data.ng_words ?? [],
  };
}

export async function saveGhostSettings(settings: GhostSettings, userId?: string): Promise<GhostSettings> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { error } = await supabaseAdmin.from("ghost_settings").upsert(
    {
      user_id: scopedUserId,
      profile_url: settings.profileUrl,
      ng_words: settings.ngWords,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  return getGhostSettings(scopedUserId);
}

export async function getCreditSummary(userId?: string): Promise<CreditSummary> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin.rpc("get_credit_summary", {
    p_user_id: scopedUserId,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    remaining: Number(row?.remaining ?? 0),
    used: Number(row?.used ?? 0),
    granted: Number(row?.granted ?? 0),
  };
}

export async function getUserProfile(user: User, userId?: string): Promise<UserProfileSettings> {
  const scopedUserId = await resolveScopedUserId(userId ?? user.id);
  const row = await requireProfileRow(scopedUserId);

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? getUserDisplayName(user) ?? "Googleユーザー",
    avatarUrl:
      typeof user.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url !== ""
        ? user.user_metadata.avatar_url
        : null,
    planName: "無料",
    defaultEmotion: row.default_emotion ?? "empathy",
    writingStyle: row.writing_style ?? "casual",
    sentenceStyle: row.sentence_style ?? "friendly",
  };
}

export async function updateUserProfile(
  user: User,
  payload: Pick<UserProfileSettings, "displayName" | "defaultEmotion" | "writingStyle" | "sentenceStyle">,
  userId?: string,
): Promise<UserProfileSettings> {
  const scopedUserId = await resolveScopedUserId(userId ?? user.id);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      display_name: payload.displayName.trim(),
      default_emotion: payload.defaultEmotion,
      writing_style: payload.writingStyle,
      sentence_style: payload.sentenceStyle,
    })
    .eq("id", scopedUserId);

  if (error) {
    throw error;
  }

  return getUserProfile(user, scopedUserId);
}

export async function resetAllGenerations(userId?: string): Promise<{ deletedCount: number }> {
  const scopedUserId = await resolveScopedUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("generations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", scopedUserId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    throw error;
  }

  return { deletedCount: data.length };
}

export async function migrateLocalData(
  payload: LocalMigrationPayload,
  userId?: string,
): Promise<{ importedCount: number }> {
  const scopedUserId = await resolveScopedUserId(userId);
  const generationIds = Array.from(
    new Set(payload.generations.map((row) => row.id).filter((id): id is string => Boolean(id))),
  );

  const existingIds = new Set<string>();

  if (generationIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("generations")
      .select("id")
      .eq("user_id", scopedUserId)
      .in("id", generationIds);

    if (error) {
      throw error;
    }

    for (const row of data) {
      existingIds.add(row.id as string);
    }
  }

  const rowsToInsert = payload.generations
    .filter((row) => !existingIds.has(row.id))
    .map((row) => ({
      id: row.id,
      user_id: scopedUserId,
      draft: row.draft,
      emotion: row.emotion,
      intensity: row.intensity,
      speed_mode: row.speedMode ?? null,
      variants: row.variants,
      hashtags: row.hashtags,
      selected_index: row.selectedIndex,
      likes: row.likes,
      memo: row.memo ?? null,
      advice_hint: row.adviceHint ?? null,
      created_at: row.createdAt,
      updated_at: row.createdAt,
    }));

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("generations").insert(rowsToInsert);

    if (insertError) {
      throw insertError;
    }

    const { error: ledgerError } = await supabaseAdmin.from("credit_ledger").insert(
      rowsToInsert.map((row) => ({
        user_id: scopedUserId,
        delta: -1,
        reason: "migration_import",
        note: "localStorage から移行",
        metadata: { generation_id: row.id },
        created_at: row.created_at,
      })),
    );

    if (ledgerError) {
      throw ledgerError;
    }
  }

  if (
    payload.ghostSettings.profileUrl.trim() !== "" ||
    payload.ghostSettings.ngWords.length > 0
  ) {
    await saveGhostSettings({
      profileUrl: payload.ghostSettings.profileUrl.trim(),
      ngWords: payload.ghostSettings.ngWords.map((word) => word.trim()).filter(Boolean),
    }, scopedUserId);
  }

  return { importedCount: rowsToInsert.length };
}
