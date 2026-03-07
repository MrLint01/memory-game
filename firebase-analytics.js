// Firebase Analytics for Flash Recall
// Firestore-backed event/session logging with player/session/version metadata.

const firebaseConfig = {
  apiKey: "AIzaSyC9Wqa3tvKDcM1yPuCgjRkwtM_xbsMmLQg",
  authDomain: "flash-recall-df7d9.firebaseapp.com",
  projectId: "flash-recall-df7d9",
  storageBucket: "flash-recall-df7d9.firebasestorage.app",
  messagingSenderId: "84239074574",
  appId: "1:84239074574:web:265f87be6b4b9df8ccc35f"
};

const PLAYER_ID_STORAGE_KEY = "flash_recall_player_id_v1";
const DISABLE_TELEMETRY_ON_LOCALHOST = false;
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const INACTIVITY_ACTIVE_PAUSE_MS = 1 * 60 * 1000;
const INACTIVITY_QUIT_MS = 3 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const FLUSH_INTERVAL_MS = 4 * 1000;
const MAX_EVENT_BUFFER = 10;

let firebaseApp = null;
let firebaseDb = null;
let currentUserId = null;
let currentSessionDocId = null;

let roundsForCurrentLevel = [];
let pendingEvents = [];
let flushTimerId = null;
let heartbeatTimerId = null;
let inactivityTimerId = null;
let inactivityActiveTimerId = null;
let isFlushingEvents = false;
let lifecycleListenersBound = false;
let hasEndedSession = false;
let inactivityQuitLogged = false;
let hiddenStartedAtMs = null;

const sessionStartedAtMs = Date.now();
let lastActivityAtMs = sessionStartedAtMs;
let activePlaytimeAccumulatedSeconds = 0;
let activeSegmentStartedAtMs = sessionStartedAtMs;
let isSessionActiveForPlaytime = true;

const playerId = getOrCreatePlayerId();
const sessionId = generateId();
const gameVersion = window.FLASH_RECALL_VERSION || "dev";
const releaseChannel = window.FLASH_RECALL_RELEASE_CHANNEL || deriveReleaseChannel();

const leaderboardSyncKey = `flashRecallLeaderboardSynced_${gameVersion}`;
const leaderboardReadBudgetKey = `flashRecallLeaderboardReadBudget_${playerId}`;
const LEADERBOARDS_ENABLED_KEY = "flashRecallLeaderboardsEnabled";
const leaderboardSessionCache = new Map();
const statsLeaderboardSessionCache = new Map();
const STATS_LEADERBOARD_CACHE_TTL_MS = 60 * 1000;
const PROGRESS_LEADERBOARD_PATH = "leaderboards_global/progress/entries";
const ACHIEVEMENT_PROFILE_PATH = "achievement_profiles";
const ACHIEVEMENT_SUMMARY_PATH = "achievements_global/summary";
const ACHIEVEMENT_ENTRY_PATH = `${ACHIEVEMENT_SUMMARY_PATH}/entries`;
const ACHIEVEMENT_CACHE_TTL_MS = 60 * 1000;
const ACHIEVEMENT_CARD_TYPE_THRESHOLDS = [1, 10, 100, 1000];
const ACHIEVEMENT_MODIFIER_VARIANT_THRESHOLDS = [10, 100, 1000];
const ACHIEVEMENT_CARD_TYPE_META = {
  numbers: { label: "Numbers", noun: "number cards", short: "NUM" },
  letters: { label: "Letters", noun: "letter cards", short: "LET" },
  shapes: { label: "Shapes", noun: "shape cards", short: "SHP" },
  directions: { label: "Directions", noun: "direction cards", short: "DIR" },
  colors: { label: "Colors", noun: "color cards", short: "CLR" },
  diagonal: { label: "Diagonals", noun: "diagonal cards", short: "DIA" },
  fruits: { label: "Fruits", noun: "fruit cards", short: "FRT" }
};
const ACHIEVEMENT_MODIFIER_META = {
  mathOps: { firstUseId: "mod_math_ops", label: "Math Ops", iconSrc: "imgs/icons/mod-mathops.svg", short: "MATH" },
  mathOpsPlus: { firstUseId: "mod_math_ops_plus", label: "Math Ops+", iconSrc: "imgs/icons/mod-mathopsplus.svg", short: "M+" },
  misleadColors: { firstUseId: "mod_mislead_colors", label: "Misleading Colors", iconSrc: "imgs/icons/mod-misleadcolors.svg", short: "MIS" },
  backgroundColor: { firstUseId: "mod_background_color", label: "Background Color", iconSrc: "imgs/icons/mod-backgroundcolor.svg", short: "BG" },
  textColor: { firstUseId: "mod_text_color", label: "Text Color", iconSrc: "imgs/icons/mod-textcolor.svg", short: "TXT" },
  previousCard: { firstUseId: "mod_previous_card", label: "Previous Card", iconSrc: "imgs/icons/mod-previouscard.svg", short: "PREV" },
  rotate: { firstUseId: "mod_rotate", label: "Rotate", iconSrc: "imgs/icons/mod-rotate.svg", short: "ROT" },
  rotatePlus: { firstUseId: "mod_rotate_plus", label: "Rotate+", iconSrc: "imgs/icons/mod-rotateplus.svg", short: "R+" },
  swapCards: { firstUseId: "mod_swap_cards", label: "Card Swap", iconSrc: "imgs/icons/mod-swapcards.svg", short: "SWAP" },
  platformer: { firstUseId: "mod_platformer", label: "Platformer", iconSrc: "imgs/icons/mod-platformer.svg", short: "PLAT" },
  glitch: { firstUseId: "mod_glitch", label: "Glitch", iconSrc: "imgs/icons/mod-glitch.svg", short: "GLT" },
  fog: { firstUseId: "mod_fog", label: "Fog", iconSrc: "imgs/icons/mod-fog.svg", short: "FOG" },
  blur: { firstUseId: "mod_blur", label: "Blur", iconSrc: "imgs/icons/mod-blur.svg", short: "BLR" },
  ads: { firstUseId: "mod_ads", label: "Ads", iconSrc: "imgs/icons/mod-ads.svg", short: "ADS" }
};
const ACHIEVEMENT_MODIFIER_MAP = Object.fromEntries(
  Object.entries(ACHIEVEMENT_MODIFIER_META).map(([key, value]) => [key, value.firstUseId])
);

function formatAchievementThresholdShort(value) {
  const count = Number(value) || 0;
  if (count >= 1000) {
    return `${Math.round(count / 1000)}K`;
  }
  return String(count);
}

function buildCardTypeAchievementDefinitions() {
  return Object.entries(ACHIEVEMENT_CARD_TYPE_META).flatMap(([key, meta]) =>
    ACHIEVEMENT_CARD_TYPE_THRESHOLDS.map((threshold) => ({
      id: `card_${key}_${threshold}`,
      title: `${meta.label} ${formatAchievementThresholdShort(threshold)}`,
      description: `See ${threshold} ${meta.noun}.`,
      iconText: `${meta.short}${formatAchievementThresholdShort(threshold)}`
    }))
  );
}

function buildModifierVariantAchievementDefinitions() {
  return Object.entries(ACHIEVEMENT_MODIFIER_META).flatMap(([key, meta]) =>
    ACHIEVEMENT_MODIFIER_VARIANT_THRESHOLDS.map((threshold) => ({
      id: `mod_variants_${key}_${threshold}`,
      title: `${meta.label} ${formatAchievementThresholdShort(threshold)}`,
      description: `Encounter ${threshold} ${meta.label} modifier variants.`,
      iconText: `${meta.short}${formatAchievementThresholdShort(threshold)}`
    }))
  );
}

const ACHIEVEMENT_DEFINITIONS = [
  ...Object.values(ACHIEVEMENT_MODIFIER_META).map((meta) => ({
    id: meta.firstUseId,
    title: meta.label,
    description: `Use the ${meta.label} modifier for the first time.`,
    iconSrc: meta.iconSrc
  })),
  ...buildCardTypeAchievementDefinitions(),
  ...buildModifierVariantAchievementDefinitions(),
  { id: "complete_1", title: "First Clear", description: "Complete one level.", iconText: "1" },
  { id: "complete_flash_1", title: "Flash Initiate", description: "Complete your first flash level.", iconText: "FLASH" },
  { id: "complete_10", title: "Ten Clears", description: "Complete 10 levels.", iconText: "10" },
  { id: "complete_all", title: "Full Clear", description: "Complete all levels.", iconText: "ALL" },
  { id: "complete_stage_67", title: "Lucky 67", description: "Complete level 67.", iconText: "67" },
  { id: "attempt_10", title: "Getting Started", description: "Attempt 10 levels.", iconText: "A10" },
  { id: "attempt_100", title: "Committed", description: "Attempt 100 levels.", iconText: "A100" },
  { id: "attempt_1000", title: "Relentless", description: "Attempt 1000 levels.", iconText: "1K" },
  { id: "attempt_10000", title: "Endless Grind", description: "Attempt 10000 levels.", iconText: "10K" },
  { id: "fail_1", title: "First Fall", description: "Fail 1 level.", iconText: "F1" },
  { id: "fail_10", title: "Still Learning", description: "Fail 10 levels.", iconText: "F10" },
  { id: "fail_100", title: "Tough Lessons", description: "Fail 100 levels.", iconText: "F100" },
  { id: "fail_1000", title: "Impossible Odds", description: "Fail 1000 levels.", iconText: "F1K" },
  { id: "stars_level_1", title: "First Star", description: "Collect 1 star on a level.", iconText: "1\u2605" },
  { id: "stars_level_2", title: "Double Star", description: "Collect 2 stars on a level.", iconText: "2\u2605" },
  { id: "stars_level_3", title: "Triple Star", description: "Collect 3 stars on a level.", iconText: "3\u2605" },
  { id: "stars_total_10", title: "Star Collector", description: "Collect 10 stars.", iconText: "10\u2605" },
  { id: "stars_total_25", title: "Star Seeker", description: "Collect 25 stars.", iconText: "25\u2605" },
  { id: "stars_total_50", title: "Star Keeper", description: "Collect 50 stars.", iconText: "50\u2605" },
  { id: "stars_total_100", title: "Star Hoard", description: "Collect 100 stars.", iconText: "100\u2605" },
  { id: "stars_total_200", title: "Star Vault", description: "Collect 200 stars.", iconText: "200\u2605" },
  { id: "stars_total_300", title: "Star Legend", description: "Collect 300 stars.", iconText: "300\u2605" },
  { id: "leaderboard_top_5", title: "Top Five", description: "Get top 5 on a leaderboard.", iconText: "TOP5" },
  { id: "leaderboard_first", title: "First Place", description: "Get first place on a leaderboard.", iconText: "#1" },
  { id: "time_minutes_10", title: "Ten Minutes In", description: "Spend 10 total in-level minutes in game.", iconText: "10m" },
  { id: "time_minutes_100", title: "Century Club", description: "Spend 100 total in-level minutes in game.", iconText: "100m" },
  { id: "theme_changed", title: "Fresh Paint", description: "Change your theme.", iconText: "THEME" },
  { id: "sandbox_played", title: "Sandbox Opened", description: "Play Sandbox.", iconText: "SBX" },
  { id: "win_monochrome", title: "Monochrome Win", description: "Beat a level with monochrome enabled.", iconText: "MONO" },
  { id: "secret_stars_level_4", title: "Hidden Mastery", description: "Collect 4 stars on a level.", iconText: "4\u2605", secret: true },
  { id: "secret_stars_total_400", title: "Hidden Galaxy", description: "Collect 400 stars.", iconText: "400\u2605", secret: true }
];
const ACHIEVEMENT_DEFINITION_BY_ID = Object.fromEntries(
  ACHIEVEMENT_DEFINITIONS.map((entry) => [entry.id, entry])
);

function getAchievementDifficultyScore(definition) {
  const id = String(definition && definition.id ? definition.id : "");
  if (definition && definition.secret) return 98;
  if (/^complete_all$|^leaderboard_first$|^time_minutes_100$|^fail_1000$/.test(id)) return 94;
  if (/^attempt_10000$|^complete_stage_67$/.test(id)) return 90;
  if (/^attempt_1000$|^fail_100$|^stars_total_300$|^stars_total_200$/.test(id)) return 82;
  if (/^attempt_100$|^complete_flash_1$|^win_monochrome$|^leaderboard_top_5$|^time_minutes_10$/.test(id)) return 70;
  if (/^complete_10$|^fail_10$|^stars_total_100$|^stars_total_50$|^theme_changed$/.test(id)) return 58;
  if (/^stars_level_3$|^stars_total_25$|^stars_level_2$/.test(id)) return 48;
  if (/^mod_variants_/.test(id)) {
    if (/_1000$/.test(id)) return 86;
    if (/_100$/.test(id)) return 64;
    return 42;
  }
  if (/^card_/.test(id)) {
    if (/_1000$/.test(id)) return 88;
    if (/_100$/.test(id)) return 62;
    if (/_10$/.test(id)) return 38;
    return 20;
  }
  if (/^mod_/.test(id)) return 22;
  if (/^complete_1$|^attempt_10$|^fail_1$|^stars_level_1$|^stars_total_10$|^sandbox_played$/.test(id)) return 18;
  return 45;
}

function getAchievementDifficultyColor(score) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const hue = Math.round(140 - (safeScore / 100) * 140);
  return `hsl(${hue} 70% 46%)`;
}
const LEGACY_ACHIEVEMENT_DEFINITIONS = [
  { id: "mod_math_ops", title: "Math Ops", description: "Use the Math ops modifier for the first time.", iconSrc: "imgs/icons/mod-mathops.svg" },
  { id: "mod_math_ops_plus", title: "Math Ops+", description: "Use the Math ops+ modifier for the first time.", iconSrc: "imgs/icons/mod-mathopsplus.svg" },
  { id: "mod_mislead_colors", title: "Misleading Colors", description: "Use the Misleading colors modifier for the first time.", iconSrc: "imgs/icons/mod-misleadcolors.svg" },
  { id: "mod_background_color", title: "Background Color", description: "Use the Background color modifier for the first time.", iconSrc: "imgs/icons/mod-backgroundcolor.svg" },
  { id: "mod_text_color", title: "Text Color", description: "Use the Text color modifier for the first time.", iconSrc: "imgs/icons/mod-textcolor.svg" },
  { id: "mod_previous_card", title: "Previous Card", description: "Use the Previous card modifier for the first time.", iconSrc: "imgs/icons/mod-previouscard.svg" },
  { id: "mod_rotate", title: "Rotate", description: "Use the Rotate modifier for the first time.", iconSrc: "imgs/icons/mod-rotate.svg" },
  { id: "mod_rotate_plus", title: "Rotate+", description: "Use the Rotate+ modifier for the first time.", iconSrc: "imgs/icons/mod-rotateplus.svg" },
  { id: "mod_swap_cards", title: "Card Swap", description: "Use the Card swap modifier for the first time.", iconSrc: "imgs/icons/mod-swapcards.svg" },
  { id: "mod_platformer", title: "Platformer", description: "Use the Platformer modifier for the first time.", iconSrc: "imgs/icons/mod-platformer.svg" },
  { id: "mod_glitch", title: "Glitch", description: "Use the Glitch modifier for the first time.", iconSrc: "imgs/icons/mod-glitch.svg" },
  { id: "mod_fog", title: "Fog", description: "Use the Fog modifier for the first time.", iconSrc: "imgs/icons/mod-fog.svg" },
  { id: "mod_blur", title: "Blur", description: "Use the Blur modifier for the first time.", iconSrc: "imgs/icons/mod-blur.svg" },
  { id: "mod_ads", title: "Ads", description: "Use the Ads modifier for the first time.", iconSrc: "imgs/icons/mod-ads.svg" },
  { id: "complete_1", title: "First Clear", description: "Complete one level.", iconText: "1" },
  { id: "complete_10", title: "Ten Clears", description: "Complete 10 levels.", iconText: "10" },
  { id: "complete_all", title: "Full Clear", description: "Complete all levels.", iconText: "ALL" },
  { id: "attempt_10", title: "Getting Started", description: "Attempt 10 levels.", iconText: "A10" },
  { id: "attempt_100", title: "Committed", description: "Attempt 100 levels.", iconText: "A100" },
  { id: "attempt_1000", title: "Relentless", description: "Attempt 1000 levels.", iconText: "1K" },
  { id: "attempt_10000", title: "Endless Grind", description: "Attempt 10000 levels.", iconText: "10K" },
  { id: "stars_level_3", title: "Triple Star", description: "Collect 3 stars on a level.", iconText: "3★" },
  { id: "stars_total_30", title: "Star Collector", description: "Collect 30 stars.", iconText: "30★" },
  { id: "stars_total_100", title: "Star Hoard", description: "Collect 100 stars.", iconText: "100★" },
  { id: "stars_total_200", title: "Star Vault", description: "Collect 200 stars.", iconText: "200★" },
  { id: "stars_total_300", title: "Star Legend", description: "Collect 300 stars.", iconText: "300★" },
  { id: "leaderboard_top_5", title: "Top Five", description: "Get top 5 on a leaderboard.", iconText: "TOP5" },
  { id: "leaderboard_first", title: "First Place", description: "Get first place on a leaderboard.", iconText: "#1" },
  { id: "time_minutes_10", title: "Ten Minutes In", description: "Spend 10 total in-level minutes in game.", iconText: "10m" },
  { id: "time_minutes_100", title: "Century Club", description: "Spend 100 total in-level minutes in game.", iconText: "100m" },
  { id: "theme_changed", title: "Fresh Paint", description: "Change your theme.", iconText: "THEME" },
  { id: "win_monochrome", title: "Monochrome Win", description: "Beat a level with monochrome enabled.", iconText: "MONO" },
  { id: "secret_stars_level_4", title: "Hidden Mastery", description: "Collect 4 stars on a level.", iconText: "4★", secret: true },
  { id: "secret_stars_total_400", title: "Hidden Galaxy", description: "Collect 400 stars.", iconText: "400★", secret: true }
];
const LEGACY_ACHIEVEMENT_MODIFIER_MAP = {
  mathOps: "mod_math_ops",
  mathOpsPlus: "mod_math_ops_plus",
  misleadColors: "mod_mislead_colors",
  backgroundColor: "mod_background_color",
  textColor: "mod_text_color",
  previousCard: "mod_previous_card",
  rotate: "mod_rotate",
  rotatePlus: "mod_rotate_plus",
  swapCards: "mod_swap_cards",
  platformer: "mod_platformer",
  glitch: "mod_glitch",
  fog: "mod_fog",
  blur: "mod_blur",
  ads: "mod_ads"
};
let achievementOverviewCache = null;
let achievementProfileCache = null;
const pendingAchievementUpdates = [];
let leaderboardReadBudget = { totalReads: 0, blocked: false };

function loadLeaderboardReadBudget() {
  leaderboardReadBudget = { totalReads: 0, blocked: false };
}

function saveLeaderboardReadBudget() {
  leaderboardReadBudget.blocked = false;
}

function remainingLeaderboardReads() {
  return Number.POSITIVE_INFINITY;
}

function incrementLeaderboardReads(count) {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (!safeCount) return;
  leaderboardReadBudget.totalReads = (Number(leaderboardReadBudget.totalReads) || 0) + safeCount;
  leaderboardReadBudget.blocked = false;
}

function areLeaderboardsEnabled() {
  try {
    const raw = window.localStorage.getItem(LEADERBOARDS_ENABLED_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch (error) {
    return true;
  }
}

function getLeaderboardCacheKey(stageId, stageVersion) {
  return `${String(stageId)}_v${Number(stageVersion) || 1}`;
}

function getDefaultLeaderboardResult(overrides = {}) {
  return {
    top: [],
    me: null,
    meRank: null,
    currentRunRank: null,
    currentRunTotalPlayers: 0,
    totalPlayers: 0,
    averageTimeMs: null,
    fromCache: false,
    stale: false,
    errorCode: null,
    errorMessage: "",
    ...overrides
  };
}

function getDefaultStatsLeaderboardResult(overrides = {}) {
  return {
    top: [],
    me: null,
    meRank: null,
    fromCache: false,
    stale: false,
    errorCode: null,
    errorMessage: "",
    ...overrides
  };
}

function computeCurrentRunComparison(entries, comparisonTimeMs) {
  const timeMs = Number(comparisonTimeMs);
  if (!Number.isFinite(timeMs)) {
    return { currentRunRank: null, currentRunTotalPlayers: 0 };
  }
  const safeEntries = Array.isArray(entries) ? entries : [];
  const activeWithoutMe = safeEntries
    .filter((entry) => entry && entry.active !== false)
    .filter((entry) => Number.isFinite(Number(entry.best_time_ms)))
    .filter((entry) => entry.player_id !== playerId);
  const fasterCount = activeWithoutMe.filter((entry) => Number(entry.best_time_ms) < timeMs).length;
  return {
    currentRunRank: fasterCount + 1,
    currentRunTotalPlayers: activeWithoutMe.length + 1
  };
}

function computeLeaderboardViewFromEntries(entries, limit = 5, comparisonTimeMs = null) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const active = safeEntries
    .filter((entry) => entry && entry.active !== false)
    .filter((entry) => Number.isFinite(Number(entry.best_time_ms)))
    .sort((a, b) => Number(a.best_time_ms) - Number(b.best_time_ms));
  const top = active.slice(0, Math.max(1, Number(limit) || 5));
  const meIndex = active.findIndex((entry) => entry && entry.player_id === playerId);
  const me = meIndex >= 0 ? active[meIndex] : null;
  const meRank = meIndex >= 0 ? meIndex + 1 : null;
  const totalPlayers = active.length;
  const averageTimeMs = totalPlayers
    ? active.reduce((sum, entry) => sum + Number(entry.best_time_ms), 0) / totalPlayers
    : null;
  return {
    top,
    me,
    meRank,
    totalPlayers,
    averageTimeMs,
    ...computeCurrentRunComparison(active, comparisonTimeMs)
  };
}

function getCachedLeaderboard(stageId, stageVersion, limit = 5, comparisonTimeMs = null) {
  const key = getLeaderboardCacheKey(stageId, stageVersion);
  const cached = leaderboardSessionCache.get(key);
  if (!cached) return null;
  const view = computeLeaderboardViewFromEntries(cached.entries, limit, comparisonTimeMs);
  return getDefaultLeaderboardResult({ ...view, fromCache: true, stale: true });
}

function setCachedLeaderboard(stageId, stageVersion, entries) {
  const key = getLeaderboardCacheKey(stageId, stageVersion);
  leaderboardSessionCache.set(key, {
    stageId: String(stageId),
    stageVersion: Number(stageVersion) || 1,
    entries: Array.isArray(entries) ? entries : [],
    loadedAtMs: Date.now()
  });
}

function upsertCachedLeaderboardEntry(stageId, stageVersion, entry) {
  if (!entry || !entry.player_id) return;
  const key = getLeaderboardCacheKey(stageId, stageVersion);
  const cached = leaderboardSessionCache.get(key);
  if (!cached || !Array.isArray(cached.entries)) return;
  const nextEntries = cached.entries.slice();
  const idx = nextEntries.findIndex((item) => item && item.player_id === entry.player_id);
  if (idx >= 0) {
    nextEntries[idx] = { ...nextEntries[idx], ...entry };
  } else {
    nextEntries.push({ ...entry });
  }
  setCachedLeaderboard(stageId, stageVersion, nextEntries);
}

function isValidStatsMetric(metric) {
  return metric === "stars_earned" || metric === "stages_cleared";
}

function computeStatsLeaderboardView(entries, metric, limit = 5) {
  if (!isValidStatsMetric(metric)) {
    return { top: [], me: null, meRank: null };
  }
  const safeEntries = Array.isArray(entries) ? entries : [];
  const active = safeEntries
    .filter((entry) => entry && entry.active !== false)
    .map((entry) => ({ ...entry, metricValue: Number(entry[metric]) || 0 }))
    .sort((a, b) => b.metricValue - a.metricValue);
  const top = active.slice(0, Math.max(1, Number(limit) || 5));
  const meIndex = active.findIndex((entry) => entry && entry.player_id === playerId);
  const me = meIndex >= 0 ? active[meIndex] : null;
  const meRank = meIndex >= 0 ? meIndex + 1 : null;
  return { top, me, meRank };
}

function getCachedStatsLeaderboard(metric, limit = 5) {
  const cached = statsLeaderboardSessionCache.get(metric);
  if (!cached) return null;
  const view = computeStatsLeaderboardView(cached.entries, metric, limit);
  const ageMs = Date.now() - cached.loadedAtMs;
  return getDefaultStatsLeaderboardResult({
    ...view,
    fromCache: true,
    stale: ageMs > STATS_LEADERBOARD_CACHE_TTL_MS
  });
}

function setCachedStatsLeaderboard(metric, entries) {
  if (!isValidStatsMetric(metric)) return;
  statsLeaderboardSessionCache.set(metric, {
    metric,
    entries: Array.isArray(entries) ? entries : [],
    loadedAtMs: Date.now()
  });
}

function upsertCachedStatsEntry(entry) {
  if (!entry || !entry.player_id) return;
  ["stars_earned", "stages_cleared"].forEach((metric) => {
    const cached = statsLeaderboardSessionCache.get(metric);
    if (!cached || !Array.isArray(cached.entries)) return;
    const nextEntries = cached.entries.slice();
    const idx = nextEntries.findIndex((item) => item && item.player_id === entry.player_id);
    if (idx >= 0) {
      nextEntries[idx] = { ...nextEntries[idx], ...entry };
    } else {
      nextEntries.push({ ...entry });
    }
    setCachedStatsLeaderboard(metric, nextEntries);
  });
}

function getAchievementCatalog() {
  return ACHIEVEMENT_DEFINITIONS.map((entry) => ({ ...entry }));
}

function getDefaultAchievementTheme() {
  const defaults = typeof window.getFlashRecallSettingsDefaults === "function"
    ? window.getFlashRecallSettingsDefaults()
    : (window.FLASH_RECALL_SETTINGS_DEFAULTS || {});
  const appearance = defaults && typeof defaults === "object" ? defaults.appearance || {} : {};
  return appearance && appearance.theme ? String(appearance.theme) : "studio-light";
}

function getAchievementProfileRef() {
  if (!firebaseDb) return null;
  return firebaseDb.collection(ACHIEVEMENT_PROFILE_PATH).doc(playerId);
}

function getAchievementSummaryRef() {
  if (!firebaseDb) return null;
  return firebaseDb.doc(ACHIEVEMENT_SUMMARY_PATH);
}

function getAchievementEntryRef(achievementId) {
  if (!firebaseDb) return null;
  return firebaseDb.doc(`${ACHIEVEMENT_ENTRY_PATH}/${achievementId}`);
}

function getDefaultAchievementProfile() {
  return {
    player_id: playerId,
    auth_uid: currentUserId,
    player_name: "",
    attempt_count: 0,
    failed_count: 0,
    completed_count: 0,
    total_stars: 0,
    total_time_seconds: 0,
    max_stars_on_level: 0,
    total_stages: 0,
    sandbox_played: false,
    completed_flash_level: false,
    completed_stage_67: false,
    theme_changed: false,
    monochrome_win: false,
    leaderboard_top_5: false,
    leaderboard_first_place: false,
    used_modifiers: {},
    card_type_counts: {},
    modifier_variant_counts: {},
    unlocked: {}
  };
}

function normalizeAchievementCounterMap(raw) {
  const next = {};
  const source = raw && typeof raw === "object" ? raw : {};
  Object.keys(source).forEach((key) => {
    const value = Math.max(0, Math.floor(Number(source[key]) || 0));
    if (value > 0) {
      next[key] = value;
    }
  });
  return next;
}

function normalizeAchievementProfile(raw) {
  const base = getDefaultAchievementProfile();
  const source = raw && typeof raw === "object" ? raw : {};
  base.player_name = source.player_name || "";
  base.attempt_count = Math.max(0, Number(source.attempt_count) || 0);
  base.failed_count = Math.max(0, Number(source.failed_count) || 0);
  base.completed_count = Math.max(0, Number(source.completed_count) || 0);
  base.total_stars = Math.max(0, Number(source.total_stars) || 0);
  base.total_time_seconds = Math.max(0, Number(source.total_time_seconds) || 0);
  base.max_stars_on_level = Math.max(0, Number(source.max_stars_on_level) || 0);
  base.total_stages = Math.max(0, Number(source.total_stages) || 0);
  base.sandbox_played = Boolean(source.sandbox_played);
  base.completed_flash_level = Boolean(source.completed_flash_level);
  base.completed_stage_67 = Boolean(source.completed_stage_67);
  base.theme_changed = Boolean(source.theme_changed);
  base.monochrome_win = Boolean(source.monochrome_win);
  base.leaderboard_top_5 = Boolean(source.leaderboard_top_5);
  base.leaderboard_first_place = Boolean(source.leaderboard_first_place);
  base.used_modifiers = source.used_modifiers && typeof source.used_modifiers === "object"
    ? { ...source.used_modifiers }
    : {};
  base.card_type_counts = normalizeAchievementCounterMap(source.card_type_counts);
  base.modifier_variant_counts = normalizeAchievementCounterMap(source.modifier_variant_counts);
  base.unlocked = source.unlocked && typeof source.unlocked === "object"
    ? { ...source.unlocked }
    : {};
  return base;
}

function getLocalStatsSnapshot() {
  const sessionStats = window.flashRecallSessionStats || {};
  let stored = null;
  try {
    const raw = window.localStorage.getItem("flashRecallStats");
    stored = raw ? JSON.parse(raw) : null;
  } catch (error) {
    stored = null;
  }
  const totalSeconds = Math.max(
    Number(stored && stored.totalSeconds) || 0,
    Number(sessionStats.totalSeconds) || 0
  );
  const totalLevelAttempts = Math.max(
    Number(stored && stored.totalLevelAttempts) || 0,
    Number(sessionStats.totalLevelAttempts) || 0
  );
  const totalLevelSuccesses = Math.max(
    Number(stored && stored.totalLevelSuccesses) || 0,
    Number(sessionStats.totalLevelSuccesses) || 0
  );
  const failedLevelCount = Math.max(
    Number(stored && stored.failedLevelCount) || 0,
    Number(sessionStats.failedLevelCount) || 0
  );
  const sandboxPlayed = Boolean(
    (stored && stored.sandboxPlayed) ||
    (sessionStats && sessionStats.sandboxPlayed)
  );
  const cardTypeCounts = {
    ...normalizeAchievementCounterMap(stored && stored.cardTypeCounts),
    ...normalizeAchievementCounterMap(sessionStats && sessionStats.cardTypeCounts)
  };
  const modifierVariantCounts = {
    ...normalizeAchievementCounterMap(stored && stored.modifierVariantCounts),
    ...normalizeAchievementCounterMap(sessionStats && sessionStats.modifierVariantCounts)
  };
  return {
    totalSeconds,
    totalLevelAttempts,
    totalLevelSuccesses,
    failedLevelCount,
    sandboxPlayed,
    cardTypeCounts,
    modifierVariantCounts
  };
}

function getCompletedStageCount() {
  const completed = window.stageCompleted || {};
  return Object.keys(completed).reduce((sum, key) => sum + (completed[key] ? 1 : 0), 0);
}

function getStarProgressSnapshot() {
  const stars = window.stageStars || {};
  let totalStars = 0;
  let maxStarsOnLevel = 0;
  Object.keys(stars).forEach((key) => {
    const value = Math.max(0, Number(stars[key]) || 0);
    totalStars += value;
    if (value > maxStarsOnLevel) {
      maxStarsOnLevel = value;
    }
  });
  return { totalStars, maxStarsOnLevel };
}

function getRetroactiveModifierUsage() {
  const used = {};
  const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
  stages.forEach((stage, index) => {
    const stageKey = window.getStageStarsKey
      ? window.getStageStarsKey(stage, index)
      : (stage && stage.id ? String(stage.id) : String(index + 1));
    if (!window.stageCompleted || !window.stageCompleted[stageKey]) return;
    const modifiers = window.getStageModifiers
      ? window.getStageModifiers(stage)
      : (stage && stage.modifiers ? stage.modifiers : {});
    Object.keys(ACHIEVEMENT_MODIFIER_MAP).forEach((modifierKey) => {
      if (modifiers && modifiers[modifierKey]) {
        used[modifierKey] = true;
      }
    });
  });
  return Object.keys(used);
}

function getTotalStagesCount() {
  return Array.isArray(window.stagesConfig) ? window.stagesConfig.length : 0;
}

function getCompletedStageAchievementFlags() {
  const completed = window.stageCompleted || {};
  const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
  let completedFlashLevel = false;
  let completedStage67 = false;
  stages.forEach((stage, index) => {
    const key = window.getStageStarsKey
      ? window.getStageStarsKey(stage, index)
      : (stage && stage.id ? String(stage.id) : String(index + 1));
    if (!completed[key]) return;
    if (String(stage && stage.stageType ? stage.stageType : "").toLowerCase() === "flash") {
      completedFlashLevel = true;
    }
    if (Number(stage && stage.id) === 67 || index === 66) {
      completedStage67 = true;
    }
  });
  return { completedFlashLevel, completedStage67 };
}

function normalizeAchievementUpdate(update = {}) {
  const base = {
    playerName: "",
    attemptCount: null,
    failedCount: null,
    completedCount: null,
    totalStars: null,
    totalTimeSeconds: null,
    maxStarsOnLevel: null,
    totalStages: null,
    sandboxPlayed: false,
    completedFlashLevel: false,
    completedStage67: false,
    themeChanged: false,
    monochromeWin: false,
    leaderboardTop5: false,
    leaderboardFirstPlace: false,
    usedModifiers: [],
    cardTypeCounts: {},
    modifierVariantCounts: {}
  };
  if (!update || typeof update !== "object") return base;
  base.playerName = update.playerName || "";
  base.attemptCount = Number.isFinite(Number(update.attemptCount)) ? Math.max(0, Number(update.attemptCount)) : null;
  base.failedCount = Number.isFinite(Number(update.failedCount)) ? Math.max(0, Number(update.failedCount)) : null;
  base.completedCount = Number.isFinite(Number(update.completedCount)) ? Math.max(0, Number(update.completedCount)) : null;
  base.totalStars = Number.isFinite(Number(update.totalStars)) ? Math.max(0, Number(update.totalStars)) : null;
  base.totalTimeSeconds = Number.isFinite(Number(update.totalTimeSeconds)) ? Math.max(0, Number(update.totalTimeSeconds)) : null;
  base.maxStarsOnLevel = Number.isFinite(Number(update.maxStarsOnLevel)) ? Math.max(0, Number(update.maxStarsOnLevel)) : null;
  base.totalStages = Number.isFinite(Number(update.totalStages)) ? Math.max(0, Number(update.totalStages)) : null;
  base.sandboxPlayed = Boolean(update.sandboxPlayed);
  base.completedFlashLevel = Boolean(update.completedFlashLevel);
  base.completedStage67 = Boolean(update.completedStage67);
  base.themeChanged = Boolean(update.themeChanged);
  base.monochromeWin = Boolean(update.monochromeWin);
  base.leaderboardTop5 = Boolean(update.leaderboardTop5);
  base.leaderboardFirstPlace = Boolean(update.leaderboardFirstPlace);
  base.usedModifiers = Array.isArray(update.usedModifiers)
    ? Array.from(new Set(update.usedModifiers.filter((key) => typeof key === "string" && ACHIEVEMENT_MODIFIER_MAP[key])))
    : [];
  base.cardTypeCounts = normalizeAchievementCounterMap(update.cardTypeCounts);
  base.modifierVariantCounts = normalizeAchievementCounterMap(update.modifierVariantCounts);
  return base;
}

function mergeAchievementUpdateInputs(...updates) {
  const merged = normalizeAchievementUpdate();
  updates.forEach((input) => {
    const update = normalizeAchievementUpdate(input);
    if (update.playerName) {
      merged.playerName = update.playerName;
    }
    if (Number.isFinite(update.attemptCount)) {
      merged.attemptCount = Math.max(Number(merged.attemptCount) || 0, update.attemptCount);
    }
    if (Number.isFinite(update.failedCount)) {
      merged.failedCount = Math.max(Number(merged.failedCount) || 0, update.failedCount);
    }
    if (Number.isFinite(update.completedCount)) {
      merged.completedCount = Math.max(Number(merged.completedCount) || 0, update.completedCount);
    }
    if (Number.isFinite(update.totalStars)) {
      merged.totalStars = Math.max(Number(merged.totalStars) || 0, update.totalStars);
    }
    if (Number.isFinite(update.totalTimeSeconds)) {
      merged.totalTimeSeconds = Math.max(Number(merged.totalTimeSeconds) || 0, update.totalTimeSeconds);
    }
    if (Number.isFinite(update.maxStarsOnLevel)) {
      merged.maxStarsOnLevel = Math.max(Number(merged.maxStarsOnLevel) || 0, update.maxStarsOnLevel);
    }
    if (Number.isFinite(update.totalStages)) {
      merged.totalStages = Math.max(Number(merged.totalStages) || 0, update.totalStages);
    }
    merged.sandboxPlayed = merged.sandboxPlayed || update.sandboxPlayed;
    merged.completedFlashLevel = merged.completedFlashLevel || update.completedFlashLevel;
    merged.completedStage67 = merged.completedStage67 || update.completedStage67;
    merged.themeChanged = merged.themeChanged || update.themeChanged;
    merged.monochromeWin = merged.monochromeWin || update.monochromeWin;
    merged.leaderboardTop5 = merged.leaderboardTop5 || update.leaderboardTop5;
    merged.leaderboardFirstPlace = merged.leaderboardFirstPlace || update.leaderboardFirstPlace;
    merged.usedModifiers = Array.from(new Set(merged.usedModifiers.concat(update.usedModifiers)));
    merged.cardTypeCounts = {
      ...merged.cardTypeCounts,
      ...Object.keys(update.cardTypeCounts || {}).reduce((acc, key) => {
        acc[key] = Math.max(Number(merged.cardTypeCounts && merged.cardTypeCounts[key]) || 0, Number(update.cardTypeCounts[key]) || 0);
        return acc;
      }, {})
    };
    merged.modifierVariantCounts = {
      ...merged.modifierVariantCounts,
      ...Object.keys(update.modifierVariantCounts || {}).reduce((acc, key) => {
        acc[key] = Math.max(
          Number(merged.modifierVariantCounts && merged.modifierVariantCounts[key]) || 0,
          Number(update.modifierVariantCounts[key]) || 0
        );
        return acc;
      }, {})
    };
  });
  return merged;
}

function getLocalAchievementSyncUpdate(extra = {}) {
  const stats = getLocalStatsSnapshot();
  const completedCount = getCompletedStageCount();
  const starSnapshot = getStarProgressSnapshot();
  const completedStageFlags = getCompletedStageAchievementFlags();
  const currentTheme = String(document.body && document.body.dataset ? document.body.dataset.theme || "" : "");
  const themeChanged = currentTheme && currentTheme !== getDefaultAchievementTheme();
  return mergeAchievementUpdateInputs({
    playerName: getDisplayNameFallback(),
    attemptCount: stats.totalLevelAttempts,
    failedCount: stats.failedLevelCount,
    completedCount,
    totalStars: starSnapshot.totalStars,
    totalTimeSeconds: stats.totalSeconds,
    maxStarsOnLevel: starSnapshot.maxStarsOnLevel,
    totalStages: getTotalStagesCount(),
    sandboxPlayed: stats.sandboxPlayed,
    completedFlashLevel: completedStageFlags.completedFlashLevel,
    completedStage67: completedStageFlags.completedStage67,
    themeChanged,
    usedModifiers: getRetroactiveModifierUsage(),
    cardTypeCounts: stats.cardTypeCounts,
    modifierVariantCounts: stats.modifierVariantCounts
  }, extra);
}

function mergeAchievementProfileWithUpdate(profile, update) {
  const next = normalizeAchievementProfile(profile);
  const normalized = normalizeAchievementUpdate(update);
  if (normalized.playerName) {
    next.player_name = normalized.playerName;
  }
  if (Number.isFinite(normalized.attemptCount)) {
    next.attempt_count = Math.max(next.attempt_count, normalized.attemptCount);
  }
  if (Number.isFinite(normalized.failedCount)) {
    next.failed_count = Math.max(next.failed_count, normalized.failedCount);
  }
  if (Number.isFinite(normalized.completedCount)) {
    next.completed_count = Math.max(next.completed_count, normalized.completedCount);
  }
  if (Number.isFinite(normalized.totalStars)) {
    next.total_stars = Math.max(next.total_stars, normalized.totalStars);
  }
  if (Number.isFinite(normalized.totalTimeSeconds)) {
    next.total_time_seconds = Math.max(next.total_time_seconds, normalized.totalTimeSeconds);
  }
  if (Number.isFinite(normalized.maxStarsOnLevel)) {
    next.max_stars_on_level = Math.max(next.max_stars_on_level, normalized.maxStarsOnLevel);
  }
  if (Number.isFinite(normalized.totalStages)) {
    next.total_stages = Math.max(next.total_stages, normalized.totalStages);
  }
  next.sandbox_played = next.sandbox_played || normalized.sandboxPlayed;
  next.completed_flash_level = next.completed_flash_level || normalized.completedFlashLevel;
  next.completed_stage_67 = next.completed_stage_67 || normalized.completedStage67;
  next.theme_changed = next.theme_changed || normalized.themeChanged;
  next.monochrome_win = next.monochrome_win || normalized.monochromeWin;
  next.leaderboard_top_5 = next.leaderboard_top_5 || normalized.leaderboardTop5;
  next.leaderboard_first_place = next.leaderboard_first_place || normalized.leaderboardFirstPlace;
  normalized.usedModifiers.forEach((modifierKey) => {
    next.used_modifiers[modifierKey] = true;
  });
  Object.keys(normalized.cardTypeCounts || {}).forEach((key) => {
    next.card_type_counts[key] = Math.max(
      Number(next.card_type_counts[key]) || 0,
      Number(normalized.cardTypeCounts[key]) || 0
    );
  });
  Object.keys(normalized.modifierVariantCounts || {}).forEach((key) => {
    next.modifier_variant_counts[key] = Math.max(
      Number(next.modifier_variant_counts[key]) || 0,
      Number(normalized.modifierVariantCounts[key]) || 0
    );
  });
  return next;
}

function getAchievementUnlockIds(profile) {
  const unlocks = [];
  Object.keys(ACHIEVEMENT_MODIFIER_MAP).forEach((modifierKey) => {
    if (profile.used_modifiers[modifierKey]) {
      unlocks.push(ACHIEVEMENT_MODIFIER_MAP[modifierKey]);
    }
  });
  Object.entries(ACHIEVEMENT_CARD_TYPE_META).forEach(([key]) => {
    const value = Math.max(0, Number(profile.card_type_counts[key]) || 0);
    ACHIEVEMENT_CARD_TYPE_THRESHOLDS.forEach((threshold) => {
      if (value >= threshold) {
        unlocks.push(`card_${key}_${threshold}`);
      }
    });
  });
  Object.entries(ACHIEVEMENT_MODIFIER_META).forEach(([key]) => {
    const value = Math.max(0, Number(profile.modifier_variant_counts[key]) || 0);
    ACHIEVEMENT_MODIFIER_VARIANT_THRESHOLDS.forEach((threshold) => {
      if (value >= threshold) {
        unlocks.push(`mod_variants_${key}_${threshold}`);
      }
    });
  });
  if (profile.completed_count >= 1) unlocks.push("complete_1");
  if (profile.completed_flash_level) unlocks.push("complete_flash_1");
  if (profile.completed_count >= 10) unlocks.push("complete_10");
  if (profile.total_stages > 0 && profile.completed_count >= profile.total_stages) unlocks.push("complete_all");
  if (profile.completed_stage_67) unlocks.push("complete_stage_67");
  if (profile.attempt_count >= 10) unlocks.push("attempt_10");
  if (profile.attempt_count >= 100) unlocks.push("attempt_100");
  if (profile.attempt_count >= 1000) unlocks.push("attempt_1000");
  if (profile.attempt_count >= 10000) unlocks.push("attempt_10000");
  if (profile.failed_count >= 1) unlocks.push("fail_1");
  if (profile.failed_count >= 10) unlocks.push("fail_10");
  if (profile.failed_count >= 100) unlocks.push("fail_100");
  if (profile.failed_count >= 1000) unlocks.push("fail_1000");
  if (profile.max_stars_on_level >= 1) unlocks.push("stars_level_1");
  if (profile.max_stars_on_level >= 2) unlocks.push("stars_level_2");
  if (profile.max_stars_on_level >= 3) unlocks.push("stars_level_3");
  if (profile.total_stars >= 10) unlocks.push("stars_total_10");
  if (profile.total_stars >= 25) unlocks.push("stars_total_25");
  if (profile.total_stars >= 50) unlocks.push("stars_total_50");
  if (profile.total_stars >= 100) unlocks.push("stars_total_100");
  if (profile.total_stars >= 200) unlocks.push("stars_total_200");
  if (profile.total_stars >= 300) unlocks.push("stars_total_300");
  if (profile.leaderboard_top_5) unlocks.push("leaderboard_top_5");
  if (profile.leaderboard_first_place) unlocks.push("leaderboard_first");
  if (profile.total_time_seconds >= 10 * 60) unlocks.push("time_minutes_10");
  if (profile.total_time_seconds >= 100 * 60) unlocks.push("time_minutes_100");
  if (profile.theme_changed) unlocks.push("theme_changed");
  if (profile.sandbox_played) unlocks.push("sandbox_played");
  if (profile.monochrome_win) unlocks.push("win_monochrome");
  if (profile.max_stars_on_level >= 4) unlocks.push("secret_stars_level_4");
  if (profile.total_stars >= 400) unlocks.push("secret_stars_total_400");
  return Array.from(new Set(unlocks));
}

function setAchievementOverviewCache(profile, totalPlayers, countsById = null) {
  achievementProfileCache = normalizeAchievementProfile(profile);
  if (achievementOverviewCache) {
    achievementOverviewCache.profile = normalizeAchievementProfile(profile);
    achievementOverviewCache.totalPlayers = Math.max(0, Number(totalPlayers) || 0);
    if (countsById) {
      achievementOverviewCache.countsById = { ...countsById };
    }
    achievementOverviewCache.loadedAtMs = Date.now();
    return;
  }
  achievementOverviewCache = {
    profile: normalizeAchievementProfile(profile),
    totalPlayers: Math.max(0, Number(totalPlayers) || 0),
    countsById: countsById ? { ...countsById } : {},
    loadedAtMs: Date.now()
  };
}

async function applyAchievementUpdate(update = {}) {
  const normalizedUpdate = normalizeAchievementUpdate(update);
  if (!firebaseDb || !currentUserId) {
    pendingAchievementUpdates.push(normalizedUpdate);
    return { profile: achievementProfileCache || getDefaultAchievementProfile(), newlyUnlocked: [] };
  }
  const profileRef = getAchievementProfileRef();
  const summaryRef = getAchievementSummaryRef();
  if (!profileRef || !summaryRef) {
    return { profile: achievementProfileCache || getDefaultAchievementProfile(), newlyUnlocked: [] };
  }

  try {
    const result = await firebaseDb.runTransaction(async (transaction) => {
      const profileSnap = await transaction.get(profileRef);
      const summarySnap = await transaction.get(summaryRef);
      const existingProfile = normalizeAchievementProfile(profileSnap.exists ? profileSnap.data() : null);
      const nextProfile = mergeAchievementProfileWithUpdate(existingProfile, normalizedUpdate);
      const nextUnlockedMap = { ...existingProfile.unlocked };
      const achievementIds = getAchievementUnlockIds(nextProfile);
      const newlyUnlocked = achievementIds.filter((id) => !existingProfile.unlocked[id]);
      newlyUnlocked.forEach((id) => {
        nextUnlockedMap[id] = true;
      });
      nextProfile.unlocked = nextUnlockedMap;

      const payload = {
        player_id: playerId,
        auth_uid: currentUserId,
        player_name: nextProfile.player_name || getDisplayNameFallback(),
        attempt_count: nextProfile.attempt_count,
        failed_count: nextProfile.failed_count,
        completed_count: nextProfile.completed_count,
        total_stars: nextProfile.total_stars,
        total_time_seconds: nextProfile.total_time_seconds,
        max_stars_on_level: nextProfile.max_stars_on_level,
        total_stages: nextProfile.total_stages,
        sandbox_played: nextProfile.sandbox_played,
        completed_flash_level: nextProfile.completed_flash_level,
        completed_stage_67: nextProfile.completed_stage_67,
        theme_changed: nextProfile.theme_changed,
        monochrome_win: nextProfile.monochrome_win,
        leaderboard_top_5: nextProfile.leaderboard_top_5,
        leaderboard_first_place: nextProfile.leaderboard_first_place,
        used_modifiers: nextProfile.used_modifiers,
        card_type_counts: nextProfile.card_type_counts,
        modifier_variant_counts: nextProfile.modifier_variant_counts,
        unlocked: nextProfile.unlocked,
        active: true,
        game_version: gameVersion,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (!profileSnap.exists) {
        payload.created_at = firebase.firestore.FieldValue.serverTimestamp();
      }
      transaction.set(profileRef, payload, { merge: true });

      const totalPlayers = Math.max(
        0,
        Number(summarySnap.exists && summarySnap.data() ? summarySnap.data().total_players : 0) + (profileSnap.exists ? 0 : 1)
      );
      if (!profileSnap.exists) {
        transaction.set(summaryRef, {
          total_players: firebase.firestore.FieldValue.increment(1),
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        transaction.set(summaryRef, {
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      newlyUnlocked.forEach((achievementId) => {
        const entryRef = getAchievementEntryRef(achievementId);
        if (!entryRef) return;
        transaction.set(entryRef, {
          achievement_id: achievementId,
          unlocked_count: firebase.firestore.FieldValue.increment(1),
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      return {
        profile: nextProfile,
        newlyUnlocked,
        totalPlayers
      };
    });

    const countsById = achievementOverviewCache && achievementOverviewCache.countsById
      ? { ...achievementOverviewCache.countsById }
      : {};
    result.newlyUnlocked.forEach((achievementId) => {
      countsById[achievementId] = (Number(countsById[achievementId]) || 0) + 1;
    });
    setAchievementOverviewCache(result.profile, result.totalPlayers, countsById);
    if (result.newlyUnlocked.length) {
      const items = result.newlyUnlocked
        .map((achievementId) => ACHIEVEMENT_DEFINITION_BY_ID[achievementId])
        .filter(Boolean)
        .map((definition) => {
          const difficultyScore = getAchievementDifficultyScore(definition);
          return {
            ...definition,
            unlocked: true,
            difficultyScore,
            difficultyColor: getAchievementDifficultyColor(difficultyScore)
          };
        });
      window.dispatchEvent(new CustomEvent("flashrecall:achievements-unlocked", {
        detail: { items }
      }));
    }
    return result;
  } catch (error) {
    console.warn("Failed to update achievements", error);
    pendingAchievementUpdates.push(normalizedUpdate);
    return { profile: achievementProfileCache || getDefaultAchievementProfile(), newlyUnlocked: [] };
  }
}

async function syncAchievementsFromLocal(extra = {}) {
  const mergedUpdate = mergeAchievementUpdateInputs(getLocalAchievementSyncUpdate(), ...pendingAchievementUpdates.splice(0), extra);
  return applyAchievementUpdate(mergedUpdate);
}

async function updateLeaderboardAchievementFlags(stageId, stageVersion, playerTimeMs) {
  if (!Number.isFinite(Number(playerTimeMs))) return;
  const rankData = await getPlayerRankAndPercentile(stageId, stageVersion, Number(playerTimeMs));
  if (!rankData) return;
  const update = {};
  if (rankData.rank <= 5) {
    update.leaderboardTop5 = true;
  }
  if (rankData.rank === 1) {
    update.leaderboardFirstPlace = true;
  }
  if (Object.keys(update).length) {
    await applyAchievementUpdate({
      ...update,
      playerName: getDisplayNameFallback(),
      totalStages: getTotalStagesCount()
    });
  }
}

function buildAchievementOverviewResult(profile, totalPlayers, countsById, overrides = {}) {
  const normalizedProfile = normalizeAchievementProfile(profile);
  const safeCounts = countsById && typeof countsById === "object" ? countsById : {};
  const safeTotalPlayers = Math.max(0, Number(totalPlayers) || 0);
  const items = ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const unlocked = Boolean(normalizedProfile.unlocked[definition.id]);
    const unlockedCount = Math.max(0, Number(safeCounts[definition.id]) || 0);
    const percentUnlocked = safeTotalPlayers > 0
      ? Math.round((unlockedCount / safeTotalPlayers) * 100)
      : 0;
    const difficultyScore = getAchievementDifficultyScore(definition);
    return {
      ...definition,
      unlocked,
      unlockedCount,
      percentUnlocked,
      difficultyScore,
      difficultyColor: getAchievementDifficultyColor(difficultyScore)
    };
  });
  return {
    ready: Boolean(firebaseDb && currentUserId),
    totalPlayers: safeTotalPlayers,
    unlockedCount: items.filter((item) => item.unlocked).length,
    totalCount: items.length,
    profile: normalizedProfile,
    items,
    errorCode: null,
    errorMessage: "",
    ...overrides
  };
}

async function fetchAchievementOverview(options = {}) {
  const refresh = Boolean(options && options.refresh);
  const syncLocal = options && Object.prototype.hasOwnProperty.call(options, "syncLocal")
    ? Boolean(options.syncLocal)
    : true;
  if (syncLocal) {
    await syncAchievementsFromLocal();
  }
  if (!firebaseDb || !currentUserId) {
    return buildAchievementOverviewResult(
      achievementProfileCache || getDefaultAchievementProfile(),
      achievementOverviewCache ? achievementOverviewCache.totalPlayers : 0,
      achievementOverviewCache ? achievementOverviewCache.countsById : {},
      {
        ready: false,
        errorCode: "not_ready",
        errorMessage: "Achievements are not ready yet."
      }
    );
  }
  if (
    !refresh &&
    achievementOverviewCache &&
    Date.now() - achievementOverviewCache.loadedAtMs < ACHIEVEMENT_CACHE_TTL_MS
  ) {
    return buildAchievementOverviewResult(
      achievementOverviewCache.profile,
      achievementOverviewCache.totalPlayers,
      achievementOverviewCache.countsById,
      { ready: true }
    );
  }
  try {
    const profileRef = getAchievementProfileRef();
    const summaryRef = getAchievementSummaryRef();
    const [profileSnap, summarySnap, entrySnap] = await Promise.all([
      profileRef ? profileRef.get() : Promise.resolve(null),
      summaryRef ? summaryRef.get() : Promise.resolve(null),
      firebaseDb.collection(ACHIEVEMENT_ENTRY_PATH).get()
    ]);
    const profile = normalizeAchievementProfile(profileSnap && profileSnap.exists ? profileSnap.data() : null);
    const totalPlayers = Math.max(0, Number(summarySnap && summarySnap.exists && summarySnap.data()
      ? summarySnap.data().total_players
      : 0));
    const countsById = {};
    entrySnap.forEach((doc) => {
      countsById[doc.id] = Math.max(0, Number(doc.data() && doc.data().unlocked_count) || 0);
    });
    setAchievementOverviewCache(profile, totalPlayers, countsById);
    return buildAchievementOverviewResult(profile, totalPlayers, countsById, { ready: true });
  } catch (error) {
    console.warn("Failed to fetch achievements overview", error);
    return buildAchievementOverviewResult(
      achievementProfileCache || getDefaultAchievementProfile(),
      achievementOverviewCache ? achievementOverviewCache.totalPlayers : 0,
      achievementOverviewCache ? achievementOverviewCache.countsById : {},
      {
        ready: false,
        errorCode: "fetch_failed",
        errorMessage: "Could not load achievements right now."
      }
    );
  }
}

function getDisplayNameFallback() {
  if (typeof window.getPlayerName === "function") {
    const name = window.getPlayerName();
    if (name) return name;
  }
  return `Player ${playerId}`;
}

loadLeaderboardReadBudget();

function getStageLeaderboardPath(stageId, stageVersion) {
  const safeStageId = String(stageId);
  const safeVersion = Number(stageVersion) || 1;
  return `leaderboards/stage_${safeStageId}/versions/v${safeVersion}/entries`;
}

async function fetchLeaderboardDoc(path, id) {
  if (!firebaseDb) return null;
  if (!areLeaderboardsEnabled()) return null;
  if (leaderboardReadBudget.blocked || remainingLeaderboardReads() < 1) {
    leaderboardReadBudget.blocked = true;
    saveLeaderboardReadBudget();
    return null;
  }
  try {
    const docRef = firebaseDb.doc(`${path}/${id}`);
    console.log(`Fetching leaderboard doc at ${path}/${id}`);
    const snap = await docRef.get();
    incrementLeaderboardReads(1);
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.warn("Failed to fetch leaderboard doc", error);
    return null;
  }
}

async function updateStageLeaderboard(stageId, stageVersion, timeSeconds, playerName) {
  if (!firebaseDb || !currentUserId) return;
  if (!areLeaderboardsEnabled()) return;
  const bestTimeMs = Number.isFinite(timeSeconds) ? Math.round(timeSeconds * 1000) : null;
  if (!Number.isFinite(bestTimeMs)) return;
  const path = getStageLeaderboardPath(stageId, stageVersion);
  const entryId = playerId;
  const cachedView = getCachedLeaderboard(stageId, stageVersion, 5);
  const cachedMe = cachedView && cachedView.me ? cachedView.me : null;
  const existing = cachedMe || (await fetchLeaderboardDoc(path, entryId));
  const resolvedBest =
    existing && Number.isFinite(existing.best_time_ms)
      ? Math.min(existing.best_time_ms, bestTimeMs)
      : bestTimeMs;
  const resolvedName = playerName || getDisplayNameFallback();
  if (
    existing &&
    Number.isFinite(existing.best_time_ms) &&
    existing.best_time_ms <= bestTimeMs &&
    existing.player_name === resolvedName
  ) {
    await updateLeaderboardAchievementFlags(stageId, stageVersion, existing.best_time_ms);
    return {
      bestTimeMs: existing.best_time_ms,
      playerName: resolvedName,
      skipped: true
    };
  }
  const payload = {
    player_id: playerId,
    player_name: resolvedName,
    auth_uid: currentUserId,
    best_time_ms: resolvedBest,
    active: true,
    game_version: gameVersion,
    stage_version: Number(stageVersion) || 1,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    // Update player entry
    await firebaseDb.doc(`${path}/${entryId}`).set(payload, { merge: true });
    console.log(`Updated leaderboard for stage ${stageId} v${stageVersion}:`, payload);
    
    // const stageMetaPath = `leaderboards/level_${stageId}/versions/v${stageVersion}/metadata`;
    // const isNewPlayer = !existing;
    
    // if (isNewPlayer) {
    //   await firebaseDb.doc(stageMetaPath).set({
    //     total_unique_players: firebase.firestore.FieldValue.increment(1),
    //     last_updated: firebase.firestore.FieldValue.serverTimestamp()
    //   }, { merge: true });
    // }
    upsertCachedLeaderboardEntry(stageId, stageVersion, payload);
    await updateLeaderboardAchievementFlags(stageId, stageVersion, resolvedBest);
    return {
      bestTimeMs: resolvedBest,
      playerName: resolvedName,
      skipped: false
    };
  } catch (error) {
    console.warn("Failed to update leaderboard", error);
    return null;
  }
}

// async function getStasgeTotalPlayers(stageId, stageVersion) {
//   if (!firebaseDb) return 0;
  
//   try {
//     const stageMetaPath = `leaderboards/level_${stageId}/versions/v${stageVersion}/metadata`;
//     const metaDoc = await firebaseDb.doc(stageMetaPath).get();
    
//     if (metaDoc.exists) {
//       return metaDoc.data().total_unique_players || 0;
//     }
//     return 0;
//   } catch (error) {
//     console.warn("Failed to fetch stage total players", error);
//     return 0;
//   }
// }

// window.getStageTotalPlayers = getStageTotalPlayers;

async function fetchStageLeaderboard(stageId, stageVersion, limit = 5, comparisonTimeMs = null) {
  if (!areLeaderboardsEnabled()) {
    return getDefaultLeaderboardResult({
      errorCode: "disabled",
      errorMessage: "Leaderboards disabled in settings."
    });
  }
  if (!firebaseDb) {
    return getDefaultLeaderboardResult({
      errorCode: "not_ready",
      errorMessage: "Leaderboard service is not ready yet."
    });
  }
  const cached = getCachedLeaderboard(stageId, stageVersion, limit, comparisonTimeMs);
  if (cached) return cached;
  if (leaderboardReadBudget.blocked || remainingLeaderboardReads() < 1) {
    leaderboardReadBudget.blocked = true;
    saveLeaderboardReadBudget();
    return getDefaultLeaderboardResult({
      errorCode: "read_budget_exceeded",
      errorMessage: "Leaderboard read limit reached for this player."
    });
  }
  const path = getStageLeaderboardPath(stageId, stageVersion);
  try {
    const pageBase = 250;
    const allEntries = [];
    let lastDoc = null;
    while (true) {
      const remaining = remainingLeaderboardReads();
      if (remaining < 1) {
        leaderboardReadBudget.blocked = true;
        saveLeaderboardReadBudget();
        break;
      }
      const pageSize = Math.max(1, Math.min(pageBase, remaining));
      let queryRef = firebaseDb.collection(path).orderBy("best_time_ms", "asc").limit(pageSize);
      if (lastDoc) {
        queryRef = queryRef.startAfter(lastDoc);
      }
      const pageSnap = await queryRef.get();
      incrementLeaderboardReads(pageSnap.size);
      if (pageSnap.empty) break;
      pageSnap.docs.forEach((doc) => {
        allEntries.push({ id: doc.id, ...doc.data() });
      });
      lastDoc = pageSnap.docs[pageSnap.docs.length - 1];
      if (pageSnap.size < pageSize) break;
    }
    setCachedLeaderboard(stageId, stageVersion, allEntries);
    const view = computeLeaderboardViewFromEntries(allEntries, limit, comparisonTimeMs);
    return getDefaultLeaderboardResult({
      ...view,
      fromCache: false,
      stale: false,
      errorCode: leaderboardReadBudget.blocked ? "read_budget_exceeded" : null,
      errorMessage: leaderboardReadBudget.blocked
        ? "Leaderboard read limit reached for this player. Showing cached or partial data."
        : ""
    });
  } catch (error) {
    console.warn("Failed to fetch leaderboard", error);
    return getDefaultLeaderboardResult({
      errorCode: "fetch_failed",
      errorMessage: "Could not load leaderboard data right now."
    });
  }
}

async function ensureStageLeaderboardSessionCache(stageId, stageVersion) {
  const key = getLeaderboardCacheKey(stageId, stageVersion);
  if (leaderboardSessionCache.has(key)) {
    return getDefaultLeaderboardResult({ fromCache: true, stale: true });
  }
  return fetchStageLeaderboard(stageId, stageVersion, 5);
}

async function updateProgressLeaderboardSnapshot(stagesCleared, starsEarned, playerName) {
  if (!firebaseDb || !currentUserId) return;
  if (!areLeaderboardsEnabled()) return;
  const safeStagesCleared = Math.max(0, Number(stagesCleared) || 0);
  const safeStarsEarned = Math.max(0, Number(starsEarned) || 0);
  const payload = {
    player_id: playerId,
    auth_uid: currentUserId,
    player_name: playerName || getDisplayNameFallback(),
    stages_cleared: safeStagesCleared,
    stars_earned: safeStarsEarned,
    active: true,
    game_version: gameVersion,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    await firebaseDb.doc(`${PROGRESS_LEADERBOARD_PATH}/${playerId}`).set(payload, { merge: true });
    upsertCachedStatsEntry(payload);
  } catch (error) {
    console.warn("Failed to update progress leaderboard snapshot", error);
  }
}

async function fetchProgressLeaderboard(metric, limit = 5, options = {}) {
  if (!isValidStatsMetric(metric)) {
    return getDefaultStatsLeaderboardResult({
      errorCode: "invalid_metric",
      errorMessage: "Invalid leaderboard metric."
    });
  }
  if (!areLeaderboardsEnabled()) {
    return getDefaultStatsLeaderboardResult({
      errorCode: "disabled",
      errorMessage: "Leaderboards disabled in settings."
    });
  }
  if (!firebaseDb) {
    return getDefaultStatsLeaderboardResult({
      errorCode: "not_ready",
      errorMessage: "Leaderboard service is not ready yet."
    });
  }
  const cached = getCachedStatsLeaderboard(metric, limit);
  const shouldRefresh = Boolean(options && options.refresh) ||
    Boolean(options && options.refreshIfStale && cached && cached.stale);
  if (cached && !shouldRefresh) {
    return cached;
  }
  if (leaderboardReadBudget.blocked || remainingLeaderboardReads() < 1) {
    leaderboardReadBudget.blocked = true;
    saveLeaderboardReadBudget();
    return getDefaultStatsLeaderboardResult({
      ...(cached || {}),
      errorCode: "read_budget_exceeded",
      errorMessage: "Leaderboard read limit reached for this player."
    });
  }
  try {
    const remaining = remainingLeaderboardReads();
    if (remaining < 1) {
      leaderboardReadBudget.blocked = true;
      saveLeaderboardReadBudget();
      return getDefaultStatsLeaderboardResult({
        ...(cached || {}),
        errorCode: "read_budget_exceeded",
        errorMessage: "Leaderboard read limit reached for this player."
      });
    }
    const cappedLimit = Math.max(1, Math.min(Number(limit) || 5, 5, remaining));
    const queryRef = firebaseDb.collection(PROGRESS_LEADERBOARD_PATH).orderBy(metric, "desc").limit(cappedLimit);
    const pageSnap = await queryRef.get();
    incrementLeaderboardReads(pageSnap.size);
    const allEntries = [];
    pageSnap.docs.forEach((doc) => {
      allEntries.push({ id: doc.id, ...doc.data() });
    });
    setCachedStatsLeaderboard(metric, allEntries);
    const view = computeStatsLeaderboardView(allEntries, metric, limit);
    return getDefaultStatsLeaderboardResult({
      ...view,
      fromCache: false,
      stale: false,
      errorCode: leaderboardReadBudget.blocked ? "read_budget_exceeded" : null,
      errorMessage: leaderboardReadBudget.blocked
        ? "Leaderboard read limit reached for this player."
        : ""
    });
  } catch (error) {
    console.warn("Failed to fetch progress leaderboard", error);
    let errorCode = "fetch_failed";
    let errorMessage = "Could not load leaderboard data right now.";
    const rawCode = error && (error.code || error.name) ? String(error.code || error.name).toLowerCase() : "";
    if (rawCode.includes("permission-denied")) {
      errorCode = "permission_denied";
      errorMessage = "Permission denied. Check deployed Firestore rules.";
    } else if (rawCode.includes("unauthenticated")) {
      errorCode = "unauthenticated";
      errorMessage = "Auth not ready. Try reopening in a moment.";
    } else if (rawCode.includes("failed-precondition")) {
      errorCode = "failed_precondition";
      errorMessage = "Firestore index/rules precondition failed.";
    } else if (rawCode.includes("unavailable")) {
      errorCode = "service_unavailable";
      errorMessage = "Firestore temporarily unavailable.";
    }
    return getDefaultStatsLeaderboardResult({
      ...(cached || {}),
      errorCode,
      errorMessage
    });
  }
}

async function syncLocalBestTimesOnce(force = false) {
  if (!firebaseDb || !currentUserId) return;
  if (!areLeaderboardsEnabled()) return;
  try {
    if (!force && window.localStorage.getItem(leaderboardSyncKey) === "1") return;
    const bestTimes = window.stageBestTimes || {};
    const writes = [];
    Object.entries(bestTimes).forEach(([key, value]) => {
      const match = String(key).match(/^(\d+)_v(\d+)$/);
      if (!match) return;
      const stageId = match[1];
      const stageVersion = Number(match[2]) || 1;
      const timeSeconds = Number(value);
      if (!Number.isFinite(timeSeconds)) return;
      writes.push(updateStageLeaderboard(stageId, stageVersion, timeSeconds, getDisplayNameFallback()));
    });
    await Promise.all(writes);
    window.localStorage.setItem(leaderboardSyncKey, "1");
  } catch (error) {
    console.warn("Failed to sync leaderboard", error);
  }
}

async function getPlayerRankAndPercentile(stageId, stageVersion, playerTimeMs) {
  if (!firebaseDb || !Number.isFinite(playerTimeMs)) {
    return null;
  }
  if (!areLeaderboardsEnabled()) {
    return null;
  }

  try {
    const path = getStageLeaderboardPath(stageId, stageVersion);
    const entriesRef = firebaseDb.collection(path);
    
    // Count total active players
    const totalSnapshot = await entriesRef
      .where('active', '!=', false)
      .get();
    const totalPlayers = totalSnapshot.size;
    
    if (totalPlayers === 0) return null;
    
    // Count players faster than this player
    const fasterSnapshot = await entriesRef
      .where('active', '!=', false)
      .where('best_time_ms', '<', playerTimeMs)
      .get();
    const fasterCount = fasterSnapshot.size;
    
    const rank = fasterCount + 1;
    const percentBeaten = totalPlayers > 1 
      ? Math.round(((totalPlayers - rank) / (totalPlayers - 1)) * 100)
      : 0;
    
    return {
      rank: rank,
      totalPlayers: totalPlayers,
      percentBeaten: percentBeaten,
      playersFasterThan: fasterCount,
      playersSlowerThan: totalPlayers - rank
    };
  } catch (error) {
    console.error('Error calculating player rank:', error);
    return null;
  }
}

window.getPlayerRankAndPercentile = getPlayerRankAndPercentile;

async function deactivateLocalLeaderboardEntries(bestTimesOverride = null) {
  if (!firebaseDb || !currentUserId) return;
  if (!areLeaderboardsEnabled()) return;
  try {
    const bestTimes = bestTimesOverride || window.stageBestTimes || {};
    const writes = [];
    Object.keys(bestTimes).forEach((key) => {
      const match = String(key).match(/^(\d+)_v(\d+)$/);
      if (!match) return;
      const stageId = match[1];
      const stageVersion = Number(match[2]) || 1;
      const path = getStageLeaderboardPath(stageId, stageVersion);
      const docRef = firebaseDb.doc(`${path}/${playerId}`);
      writes.push(docRef.set({ active: false, auth_uid: currentUserId }, { merge: true }));
    });
    await Promise.all(writes);
  } catch (error) {
    console.warn("Failed to deactivate leaderboard entries", error);
  }
}

function deriveReleaseChannel() {
  const host = String(window.location.hostname || "").toLowerCase();
  if (host.includes("github.io")) return "github-pages";
  if (host.includes("web.app") || host.includes("firebaseapp.com")) return "firebase-hosting";
  if (host === "localhost" || host === "127.0.0.1") return "local";
  return "custom";
}

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function getOrCreatePlayerId() {
  try {
    const existing = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = generateId();
    window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, created);
    return created;
  } catch (error) {
    console.warn("Unable to access localStorage for player id:", error);
    return generateId();
  }
}

function getSessionRef() {
  if (!firebaseDb || !currentSessionDocId) return null;
  return firebaseDb.collection("game_sessions").doc(currentSessionDocId);
}

function isReadyForWrites() {
  return Boolean(firebaseDb && currentSessionDocId && currentUserId);
}

function mapEntriesToFailedCards(entries) {
  return entries
    .filter((entry) => !entry.correct)
    .map((entry) => {
      const expectedLabel =
        typeof entry.expected === "object"
          ? entry.expected.label || null
          : null;
      const expectedValue =
        typeof entry.expected === "object"
          ? entry.expected.answer || entry.expected.label || "unknown"
          : entry.expected || entry.answer || "unknown";
      const promptTarget = expectedLabel || null;
      const hintType = promptTarget
        ? String(promptTarget).toLowerCase().replace(/\s+/g, "_")
        : null;

      return {
        card_type: entry.category || "unknown",
        expected: expectedValue,
        actual: entry.userAnswer || entry.actual || entry.raw || "blank",
        position: entry.displayIndex || 0,
        prompt_target: promptTarget,
        hint_type: hintType
      };
    });
}

function normalizeLevelNumber(levelNumber) {
  return Number(levelNumber) + 1;
}

function getActivePlaytimeSeconds(nowMs = Date.now()) {
  const liveSeconds = activeSegmentStartedAtMs
    ? Math.max(0, (nowMs - activeSegmentStartedAtMs) / 1000)
    : 0;
  return Math.max(0, activePlaytimeAccumulatedSeconds + liveSeconds);
}

function finalizeActiveSegment(nowMs = Date.now()) {
  if (!activeSegmentStartedAtMs) return;
  const delta = Math.max(0, (nowMs - activeSegmentStartedAtMs) / 1000);
  activePlaytimeAccumulatedSeconds += delta;
  activeSegmentStartedAtMs = null;
}

function pausePlaytimeTracking(reason, nowMs = Date.now()) {
  if (!isSessionActiveForPlaytime) return;
  finalizeActiveSegment(nowMs);
  isSessionActiveForPlaytime = false;
  enqueueEvent("playtime_tracking_paused", {
    reason,
    active_playtime_seconds: parseFloat(getActivePlaytimeSeconds(nowMs).toFixed(2))
  });
}

function resumePlaytimeTracking(source, nowMs = Date.now()) {
  if (isSessionActiveForPlaytime) return;
  activeSegmentStartedAtMs = nowMs;
  isSessionActiveForPlaytime = true;
  enqueueEvent("playtime_tracking_resumed", {
    source,
    active_playtime_seconds: parseFloat(getActivePlaytimeSeconds(nowMs).toFixed(2))
  });
}

function scheduleFlush() {
  if (flushTimerId) return;
  flushTimerId = window.setTimeout(() => {
    flushTimerId = null;
    flushEvents();
  }, FLUSH_INTERVAL_MS);
}

function enqueueEvent(eventType, payload = {}, options = {}) {
  if (DISABLE_TELEMETRY_ON_LOCALHOST) return;
  const eventDoc = {
    event_type: eventType,
    user_id: currentUserId || null,
    player_id: playerId,
    session_id: sessionId,
    game_version: gameVersion,
    release_channel: releaseChannel,
    client_timestamp_ms: Date.now(),
    client_iso: new Date().toISOString(),
    ...payload
  };

  pendingEvents.push(eventDoc);

  if (options.immediate || pendingEvents.length >= MAX_EVENT_BUFFER) {
    flushEvents();
  } else {
    scheduleFlush();
  }
}

async function flushEvents() {
  if (isFlushingEvents || !pendingEvents.length || !isReadyForWrites()) {
    return;
  }

  const eventsToWrite = pendingEvents.splice(0, pendingEvents.length);
  isFlushingEvents = true;

  try {
    const sessionRef = getSessionRef();
    if (!sessionRef) {
      pendingEvents = eventsToWrite.concat(pendingEvents);
      return;
    }

    const batch = firebaseDb.batch();

    eventsToWrite.forEach((eventDoc) => {
      const eventRef = sessionRef.collection("events").doc();
      batch.set(eventRef, {
        ...eventDoc,
        user_id: currentUserId,
        event_timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    batch.update(sessionRef, {
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      last_activity_at: firebase.firestore.FieldValue.serverTimestamp(),
      last_event_type: eventsToWrite[eventsToWrite.length - 1].event_type
    });

    await batch.commit();
  } catch (error) {
    console.error("Failed to flush analytics events:", error);
    pendingEvents = eventsToWrite.concat(pendingEvents).slice(-200);
  } finally {
    isFlushingEvents = false;
  }
}

function startHeartbeat() {
  if (heartbeatTimerId) {
    window.clearInterval(heartbeatTimerId);
  }

  heartbeatTimerId = window.setInterval(async () => {
    const sessionRef = getSessionRef();
    if (!sessionRef) return;

  try {
    await sessionRef.update({
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      total_playtime_seconds: parseFloat(getActivePlaytimeSeconds().toFixed(2))
    });
    if (typeof window.updateProgressLeaderboardSnapshot === "function") {
      const completed = window.stageCompleted || {};
      const starMap = window.stageStars || {};
      const stagesCleared = Object.keys(completed).reduce(
        (sum, key) => sum + (completed[key] ? 1 : 0),
        0
      );
      const starsEarned = Object.keys(starMap).reduce(
        (sum, key) => sum + (Number(starMap[key]) || 0),
        0
      );
      const displayName = typeof window.getPlayerName === "function" ? window.getPlayerName() : "";
      window.updateProgressLeaderboardSnapshot(stagesCleared, starsEarned, displayName);
    }
  } catch (error) {
    console.error("Failed heartbeat update:", error);
  }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimerId) {
    window.clearInterval(heartbeatTimerId);
    heartbeatTimerId = null;
  }
}

function resetInactivityTimer() {
  if (inactivityTimerId) {
    window.clearTimeout(inactivityTimerId);
  }

  inactivityTimerId = window.setTimeout(async () => {
    if (!isReadyForWrites() || hasEndedSession || inactivityQuitLogged) return;

    inactivityQuitLogged = true;
    enqueueEvent("quit_reason", {
      reason: "inactivity_timeout"
    }, { immediate: true });
    enqueueEvent("quit_inferred_inactivity", {
      inactivity_ms: INACTIVITY_QUIT_MS
    }, { immediate: true });

    const sessionRef = getSessionRef();
    if (sessionRef) {
      try {
        await sessionRef.update({
          quit_inferred: true,
          quit_reason: "inactivity_timeout",
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error("Failed to mark inactivity quit:", error);
      }
    }
  }, INACTIVITY_QUIT_MS);
}

function resetActiveInactivityTimer() {
  if (inactivityActiveTimerId) {
    window.clearTimeout(inactivityActiveTimerId);
  }
  inactivityActiveTimerId = window.setTimeout(() => {
    if (hasEndedSession) return;
    pausePlaytimeTracking("no_input_timeout");
  }, INACTIVITY_ACTIVE_PAUSE_MS);
}

function noteActivity(source) {
  const nowMs = Date.now();
  lastActivityAtMs = nowMs;
  resumePlaytimeTracking(source, nowMs);

  if (inactivityQuitLogged && isReadyForWrites()) {
    inactivityQuitLogged = false;
    enqueueEvent("session_resumed_after_inactivity", {
      source
    }, { immediate: true });

    const sessionRef = getSessionRef();
    if (sessionRef) {
      sessionRef.update({
        quit_inferred: false,
        quit_reason: null,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      }).catch((error) => {
        console.error("Failed to clear quit_inferred flag:", error);
      });
    }
  }

  resetActiveInactivityTimer();
  resetInactivityTimer();
}

function bindLifecycleListeners() {
  if (lifecycleListenersBound) return;
  lifecycleListenersBound = true;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenStartedAtMs = Date.now();
      enqueueEvent("tab_hidden", {});
    } else {
      const hiddenDurationMs = hiddenStartedAtMs ? Date.now() - hiddenStartedAtMs : null;
      hiddenStartedAtMs = null;
      enqueueEvent("tab_visible", {
        hidden_duration_ms: hiddenDurationMs
      });
    }
  });

  window.addEventListener("focus", () => {
    enqueueEvent("window_focus", {});
  });

  window.addEventListener("blur", () => {
    enqueueEvent("window_blur", {});
  });

  window.addEventListener("pagehide", () => {
    enqueueEvent("page_hide", {}, { immediate: true });
    flushEvents();
  });

  window.addEventListener("beforeunload", () => {
    const activeContext = typeof window.getActiveLevelContext === "function"
      ? window.getActiveLevelContext()
      : null;
    if (activeContext) {
      enqueueEvent("quit_reason", {
        reason: "close_tab_mid_level",
        ...activeContext
      }, { immediate: true });
    }
    enqueueEvent("before_unload", {
      session_duration_seconds: Math.max(0, (Date.now() - sessionStartedAtMs) / 1000),
      active_playtime_seconds: parseFloat(getActivePlaytimeSeconds().toFixed(2))
    }, { immediate: true });
    flushEvents();
  });

  const activityEvents = ["pointerdown", "keydown", "touchstart", "mousedown"];
  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, () => {
      noteActivity(eventName);
    }, { passive: true });
  });
}

async function fetchIpAddressBestEffort() {
  const timeoutMs = 1500;

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch("https://api.ipify.org?format=json", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });

    window.clearTimeout(timeout);

    if (!response.ok) return null;
    const payload = await response.json();
    return payload && payload.ip ? String(payload.ip) : null;
  } catch (error) {
    return null;
  }
}

async function initializeFirebase() {
  try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    firebaseDb = firebase.firestore();
    if (!DISABLE_TELEMETRY_ON_LOCALHOST) {
      bindLifecycleListeners();
    }

    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        currentUserId = user.uid;
        console.log("Firebase anonymous user authenticated:", currentUserId);
        if (!DISABLE_TELEMETRY_ON_LOCALHOST) {
          await createNewSession();
        }
        await syncLocalBestTimesOnce();
        await syncAchievementsFromLocal();
      } else {
        try {
          await firebase.auth().signInAnonymously();
        } catch (error) {
          console.error("Failed to sign in anonymously:", error);
        }
      }
    });
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

async function createNewSession() {
  if (!firebaseDb || !currentUserId) return;

  try {
    const ipAddress = await fetchIpAddressBestEffort();

    const sessionPayload = {
      user_id: currentUserId,
      player_id: playerId,
      session_id: sessionId,
      game_version: gameVersion,
      release_channel: releaseChannel,
      site_host: window.location.host,
      page_path: window.location.pathname,
      user_agent: navigator.userAgent || "unknown",
      language: navigator.language || null,
      timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || null,
      ip_address: ipAddress,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      started_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      last_activity_at: firebase.firestore.FieldValue.serverTimestamp(),
      total_playtime_seconds: 0,
      last_level_completed: 0,
      quit_inferred: false,
      session_state: "active"
    };

    const sessionRef = await firebaseDb.collection("game_sessions").add(sessionPayload);
    currentSessionDocId = sessionRef.id;

    enqueueEvent("session_start", {
      ip_collected: Boolean(ipAddress),
      referrer: document.referrer || null,
      game_build: window.FLASH_RECALL_BUILD_ID || null
    }, { immediate: true });

    startHeartbeat();
    resetActiveInactivityTimer();
    resetInactivityTimer();
    await updateProgressLeaderboardSnapshot(0, 0, getDisplayNameFallback());

    console.log("New session created:", currentSessionDocId);
  } catch (error) {
    console.error("Failed to create session:", error);
  }
}

function trackRoundCompletion(roundNumber, passed, timeSpent, metadata = {}) {
  roundsForCurrentLevel.push({
    round_number: roundNumber,
    passed: Boolean(passed),
    time_spent: Number.isFinite(timeSpent) ? parseFloat(timeSpent.toFixed(2)) : null,
    ...metadata
  });

  enqueueEvent("round_complete", {
    round_number: roundNumber,
    passed: Boolean(passed),
    time_spent_seconds: Number.isFinite(timeSpent) ? parseFloat(timeSpent.toFixed(2)) : null,
    ...metadata
  });
}

async function trackLevelStart(levelNumber, metadata = {}) {
  if (DISABLE_TELEMETRY_ON_LOCALHOST) return;
  if (!isReadyForWrites()) {
    enqueueEvent("level_start_buffered", {
      level_number: normalizeLevelNumber(levelNumber),
      ...metadata
    });
    return;
  }

  const sessionRef = getSessionRef();
  if (!sessionRef) return;

  const normalizedLevel = normalizeLevelNumber(levelNumber);

  enqueueEvent("level_start", {
    level_number: normalizedLevel,
    ...metadata
  }, { immediate: true });

  try {
    await sessionRef.update({
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      current_level_number: normalizedLevel,
      current_level_started_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    const activeModifiers = Array.isArray(metadata.active_modifiers) ? metadata.active_modifiers : [];
    if (activeModifiers.length) {
      await applyAchievementUpdate({
        playerName: getDisplayNameFallback(),
        usedModifiers: activeModifiers,
        totalStages: getTotalStagesCount()
      });
    }
  } catch (error) {
    console.error("Failed to update session on level start:", error);
  }
}

async function trackLevelSession(levelNumber, passed, stars, elapsedSeconds, entries, endReason = "level_end", metadata = {}) {
  if (DISABLE_TELEMETRY_ON_LOCALHOST) return;
  if (!isReadyForWrites()) {
    console.warn("Firebase not initialized yet");
    return;
  }

  const safeEntries = Array.isArray(entries) ? entries : [];

  const sessionRef = getSessionRef();
  if (!sessionRef) return;

  try {
    const normalizedLevel = normalizeLevelNumber(levelNumber);
    const failedCards = mapEntriesToFailedCards(safeEntries);
    const mode = metadata.mode || (typeof window.getCurrentGameMode === "function" ? window.getCurrentGameMode() : null);
    const stageName = metadata.stage_name || null;
    const activeModifiers = Array.isArray(metadata.active_modifiers) ? metadata.active_modifiers : [];

    const attemptData = {
      user_id: currentUserId,
      player_id: playerId,
      session_id: sessionId,
      game_version: gameVersion,
      release_channel: releaseChannel,
      level_number: normalizedLevel,
      mode,
      stage_name: stageName,
      active_modifiers: activeModifiers,
      passed: Boolean(passed),
      stars: stars || 0,
      time_seconds: Number.isFinite(elapsedSeconds) ? parseFloat(elapsedSeconds.toFixed(2)) : null,
      rounds: roundsForCurrentLevel,
      cards_failed: failedCards,
      total_cards: safeEntries.length,
      cards_failed_count: failedCards.length,
      end_reason: endReason,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    await sessionRef.collection("attempts").add(attemptData);

    enqueueEvent("level_end", {
      level_number: normalizedLevel,
      mode,
      stage_name: stageName,
      active_modifiers: activeModifiers,
      passed: Boolean(passed),
      stars: stars || 0,
      time_seconds: Number.isFinite(elapsedSeconds) ? parseFloat(elapsedSeconds.toFixed(2)) : null,
      rounds_count: roundsForCurrentLevel.length,
      total_cards: safeEntries.length,
      cards_failed_count: failedCards.length,
      end_reason: endReason
    }, { immediate: true });

    if (endReason && endReason !== "level_end") {
      enqueueEvent("quit_reason", {
        reason: endReason,
        level_number: normalizedLevel,
        mode,
        stage_name: stageName
      }, { immediate: true });
    }

    const sessionUpdate = {
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      current_level_number: null
    };

    if (Boolean(passed)) {
      sessionUpdate.last_level_completed = normalizedLevel;
    }

    await sessionRef.update(sessionUpdate);

    if (typeof window.updateProgressLeaderboardSnapshot === "function") {
      const completed = window.stageCompleted || {};
      const starMap = window.stageStars || {};
      const stagesCleared = Object.keys(completed).reduce(
        (sum, key) => sum + (completed[key] ? 1 : 0),
        0
      );
      const starsEarned = Object.keys(starMap).reduce(
        (sum, key) => sum + (Number(starMap[key]) || 0),
        0
      );
      const displayName = typeof window.getPlayerName === "function" ? window.getPlayerName() : "";
      window.updateProgressLeaderboardSnapshot(stagesCleared, starsEarned, displayName);
    }

    await syncAchievementsFromLocal({
      playerName: getDisplayNameFallback(),
      usedModifiers: activeModifiers,
      maxStarsOnLevel: stars || 0,
      monochromeWin: Boolean(passed && String(document.body && document.body.dataset
        ? document.body.dataset.colorVision || ""
        : "").toLowerCase() === "monochromacy"),
      totalStages: getTotalStagesCount()
    });

    roundsForCurrentLevel = [];
  } catch (error) {
    console.error("Failed to track level session:", error);
  }
}

async function trackSessionEnd(totalSessionSeconds, lastLevelCompleted, endReason = "session_end") {
  if (DISABLE_TELEMETRY_ON_LOCALHOST) return;
  if (hasEndedSession) return;
  hasEndedSession = true;

  if (!isReadyForWrites()) {
    console.warn("No active Firebase session to end");
    return;
  }

  const sessionRef = getSessionRef();
  if (!sessionRef) return;

  if (inactivityTimerId) {
    window.clearTimeout(inactivityTimerId);
    inactivityTimerId = null;
  }
  if (inactivityActiveTimerId) {
    window.clearTimeout(inactivityActiveTimerId);
    inactivityActiveTimerId = null;
  }

  finalizeActiveSegment(Date.now());

  stopHeartbeat();

  const activePlaytimeSeconds = parseFloat(getActivePlaytimeSeconds().toFixed(2));
  const sessionElapsedSeconds = parseFloat(((Date.now() - sessionStartedAtMs) / 1000).toFixed(2));

  enqueueEvent("session_end", {
    total_playtime_seconds: activePlaytimeSeconds,
    session_elapsed_seconds: sessionElapsedSeconds,
    reported_session_seconds: Number.isFinite(totalSessionSeconds) ? parseFloat(totalSessionSeconds.toFixed(2)) : null,
    last_level_completed: Number.isFinite(lastLevelCompleted) ? lastLevelCompleted : 0,
    end_reason: endReason,
    inactive_ms_before_end: Date.now() - lastActivityAtMs
  }, { immediate: true });

  await flushEvents();

  try {
    await sessionRef.update({
      total_playtime_seconds: activePlaytimeSeconds,
      session_elapsed_seconds: sessionElapsedSeconds,
      last_level_completed: Number.isFinite(lastLevelCompleted) ? lastLevelCompleted : 0,
      ended_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      session_state: "ended",
      end_reason: endReason,
      current_level_number: null,
      quit_inferred: endReason === "inactivity_timeout"
    });
  } catch (error) {
    console.error("Failed to track session end:", error);
  }
}

function getLoggingDebugSnapshot() {
  return {
    ready: isReadyForWrites(),
    userId: currentUserId,
    sessionDocId: currentSessionDocId,
    playerId,
    sessionId,
    gameVersion,
    releaseChannel,
    pendingEvents: pendingEvents.length,
    activePlaytimeSeconds: parseFloat(getActivePlaytimeSeconds().toFixed(2)),
    isSessionActiveForPlaytime
  };
}

function trackQuitReason(reason, metadata = {}) {
  enqueueEvent("quit_reason", {
    reason: reason || "unknown",
    ...metadata
  }, { immediate: true });
}

window.trackRoundCompletion = trackRoundCompletion;
window.trackLevelStart = trackLevelStart;
window.trackLevelSession = trackLevelSession;
window.trackSessionEnd = trackSessionEnd;
window.trackQuitReason = trackQuitReason;
window.getLoggingDebugSnapshot = getLoggingDebugSnapshot;
window.updateStageLeaderboard = updateStageLeaderboard;
window.fetchStageLeaderboard = fetchStageLeaderboard;
window.ensureStageLeaderboardSessionCache = ensureStageLeaderboardSessionCache;
window.fetchProgressLeaderboard = fetchProgressLeaderboard;
window.updateProgressLeaderboardSnapshot = updateProgressLeaderboardSnapshot;
window.fetchAchievementOverview = fetchAchievementOverview;
window.getAchievementCatalog = getAchievementCatalog;
window.syncAchievementsFromLocal = syncAchievementsFromLocal;
window.recordAchievementThemeChange = async (previousTheme, nextTheme) => {
  if (!previousTheme || !nextTheme || previousTheme === nextTheme) return;
  await applyAchievementUpdate({
    playerName: getDisplayNameFallback(),
    themeChanged: true,
    totalStages: getTotalStagesCount()
  });
};
window.getLeaderboardReady = () => Boolean(firebaseDb && currentUserId);
window.getLeaderboardPlayerId = () => playerId;
window.getLeaderboardReadBudgetStatus = () => ({
  totalReads: Number(leaderboardReadBudget.totalReads) || 0,
  limit: null,
  remaining: null,
  blocked: false
});
window.rotateLeaderboardPlayerId = () => {
  try {
    window.localStorage.removeItem(PLAYER_ID_STORAGE_KEY);
    window.localStorage.removeItem(leaderboardSyncKey);
    window.localStorage.removeItem(leaderboardReadBudgetKey);
  } catch (error) {
    console.warn("Failed to rotate player id", error);
  }
};
window.getLeaderboardDisplayName = getDisplayNameFallback;
window.syncLocalBestTimesOnce = syncLocalBestTimesOnce;
window.deactivateLocalLeaderboardEntries = deactivateLocalLeaderboardEntries;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeFirebase);
} else {
  initializeFirebase();
}
