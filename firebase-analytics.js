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

function computeLeaderboardViewFromEntries(entries, limit = 5) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const active = safeEntries
    .filter((entry) => entry && entry.active !== false)
    .filter((entry) => Number.isFinite(Number(entry.best_time_ms)))
    .sort((a, b) => Number(a.best_time_ms) - Number(b.best_time_ms));
  const top = active.slice(0, Math.max(1, Number(limit) || 5));
  const meIndex = active.findIndex((entry) => entry && entry.player_id === playerId);
  const me = meIndex >= 0 ? active[meIndex] : null;
  const meRank = meIndex >= 0 ? meIndex + 1 : null;
  return { top, me, meRank };
}

function getCachedLeaderboard(stageId, stageVersion, limit = 5) {
  const key = getLeaderboardCacheKey(stageId, stageVersion);
  const cached = leaderboardSessionCache.get(key);
  if (!cached) return null;
  const view = computeLeaderboardViewFromEntries(cached.entries, limit);
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
    return;
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
  } catch (error) {
    console.warn("Failed to update leaderboard", error);
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

async function fetchStageLeaderboard(stageId, stageVersion, limit = 5) {
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
  const cached = getCachedLeaderboard(stageId, stageVersion, limit);
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
    const view = computeLeaderboardViewFromEntries(allEntries, limit);
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
