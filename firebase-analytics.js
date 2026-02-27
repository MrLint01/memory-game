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
const DISABLE_TELEMETRY_ON_LOCALHOST =
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

function getDisplayNameFallback() {
  if (typeof window.getPlayerName === "function") {
    const name = window.getPlayerName();
    if (name) return name;
  }
  return `Player ${playerId}`;
}

function getStageLeaderboardPath(stageId, stageVersion) {
  const safeStageId = String(stageId);
  const safeVersion = Number(stageVersion) || 1;
  return `leaderboards/v_${gameVersion}/stages/stage_${safeStageId}_v${safeVersion}/entries`;
}

async function fetchLeaderboardDoc(path, id) {
  if (!firebaseDb) return null;
  try {
    const docRef = firebaseDb.doc(`${path}/${id}`);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.warn("Failed to fetch leaderboard doc", error);
    return null;
  }
}

async function updateStageLeaderboard(stageId, stageVersion, timeSeconds, playerName) {
  if (!firebaseDb || !currentUserId) return;
  const bestTimeMs = Number.isFinite(timeSeconds) ? Math.round(timeSeconds * 1000) : null;
  if (!Number.isFinite(bestTimeMs)) return;
  const path = getStageLeaderboardPath(stageId, stageVersion);
  const entryId = playerId;
  const existing = await fetchLeaderboardDoc(path, entryId);
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
    best_time_ms: resolvedBest,
    active: true,
    game_version: gameVersion,
    stage_version: Number(stageVersion) || 1,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    await firebaseDb.doc(`${path}/${entryId}`).set(payload, { merge: true });
  } catch (error) {
    console.warn("Failed to update leaderboard", error);
  }
}

async function fetchStageLeaderboard(stageId, stageVersion, limit = 5) {
  if (!firebaseDb) return { top: [], me: null };
  const path = getStageLeaderboardPath(stageId, stageVersion);
  try {
    const fetchLimit = Math.max(limit * 3, 10);
    const querySnap = await firebaseDb
      .collection(path)
      .orderBy("best_time_ms", "asc")
      .limit(fetchLimit)
      .get();
    const top = querySnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((entry) => entry.active !== false)
      .slice(0, limit);
    const me = await fetchLeaderboardDoc(path, playerId);
    const safeMe = me && me.active === false ? null : me;
    return { top, me: safeMe };
  } catch (error) {
    console.warn("Failed to fetch leaderboard", error);
    return { top: [], me: null };
  }
}

async function syncLocalBestTimesOnce(force = false) {
  if (!firebaseDb || !currentUserId) return;
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

async function deactivateLocalLeaderboardEntries(bestTimesOverride = null) {
  if (!firebaseDb || !currentUserId) return;
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
      writes.push(docRef.set({ active: false }, { merge: true }));
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
window.getLeaderboardReady = () => Boolean(firebaseDb && currentUserId);
window.getLeaderboardPlayerId = () => playerId;
window.rotateLeaderboardPlayerId = () => {
  try {
    window.localStorage.removeItem(PLAYER_ID_STORAGE_KEY);
    window.localStorage.removeItem(leaderboardSyncKey);
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
