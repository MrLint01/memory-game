      function getRevealSeconds() {
        const base = Number(revealInput.value) || 5;
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          if (stage && Number(stage.revealSeconds)) {
            return Number(stage.revealSeconds);
          }
        }
        return base;
      }

      function getRecallSeconds() {
        const base = Number(recallInput.value) || 5;
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          if (stage && Number(stage.recallSeconds)) {
            return Number(stage.recallSeconds);
          }
        }
        return base;
      }

      const PLAYER_NAME_KEY = "flashRecallPlayerName";
      const PLAYER_NAME_PROMPT_KEY = "flashRecallPlayerNamePrompted";
      const APPEARANCE_THEME_KEY = "flashRecallAppearanceTheme";
      const APPEARANCE_FONT_KEY = "flashRecallAppearanceFont";
      const APPEARANCE_LAYOUT_KEY = "flashRecallAppearanceLayout";
      const KEYBINDS_STORAGE_KEY = "flashRecallKeybinds";
      const AUDIO_MASTER_KEY = "flashRecallAudioMasterVolume";
      const AUDIO_MUSIC_KEY = "flashRecallAudioMusicVolume";
      const AUDIO_EFFECTS_KEY = "flashRecallAudioEffectsVolume";
      const FLASH_WARNING_KEY = "flashRecallFlashWarning";
      const SPLASH_SEEN_KEY = "flashRecallSplashSeen";
      const settingsDefaults = typeof window.getFlashRecallSettingsDefaults === "function"
        ? window.getFlashRecallSettingsDefaults()
        : (window.FLASH_RECALL_SETTINGS_DEFAULTS || {});
      const fallbackAppearance = {
        theme: "mono-ink",
        font: "original",
        layout: "classic",
        themes: [
          "mono-ink",
          "paper-night",
          "pastel-dawn",
          "pastel-mint",
          "sunset-pop",
          "ocean-deep",
          "forest-camp",
          "cherry-cream",
          "steel-grid"
        ],
        fonts: ["original", "arcade", "rounded", "space", "mono", "poster"],
        layouts: ["classic"]
      };
      const defaultAppearance = {
        ...fallbackAppearance,
        ...(settingsDefaults.appearance || {})
      };
      const appearanceOptions = {
        themes: Array.isArray(defaultAppearance.themes) && defaultAppearance.themes.length
          ? defaultAppearance.themes
          : fallbackAppearance.themes,
        fonts: Array.isArray(defaultAppearance.fonts) && defaultAppearance.fonts.length
          ? defaultAppearance.fonts
          : fallbackAppearance.fonts,
        layouts: Array.isArray(defaultAppearance.layouts) && defaultAppearance.layouts.length
          ? defaultAppearance.layouts
          : fallbackAppearance.layouts
      };
      const defaultKeybinds = {
        retry: "r",
        stageNext: "enter",
        stageQuit: "q",
        practiceHome: "h",
        practiceSettings: "s",
        ...(settingsDefaults.keybinds || {})
      };
      const defaultControlSettings = {
        successAnimation: true,
        flashCountdown: true,
        enterToNext: true,
        flashWarningEnabled: true,
        ...(settingsDefaults.controls || {})
      };
      const defaultAudioSettings = {
        master: 100,
        music: 80,
        effects: 80,
        ...(settingsDefaults.audio || {})
      };
      let audioSettings = { ...defaultAudioSettings };
      let keybinds = { ...defaultKeybinds };
      let activeRebindAction = null;
      const keybindButtons = {
        retry: keybindRetry,
        stageNext: keybindStageNext,
        stageQuit: keybindStageQuit,
        practiceHome: keybindPracticeHome,
        practiceSettings: keybindPracticeSettings
      };

      function normalizeKey(rawKey) {
        if (!rawKey) return "";
        const key = String(rawKey);
        if (key === " ") return "space";
        if (key.length === 1) return key.toLowerCase();
        return key.toLowerCase();
      }

      function getKeyLabel(key) {
        const value = normalizeKey(key);
        if (!value) return "";
        const map = {
          escape: "Esc",
          enter: "Enter",
          tab: "Tab",
          "arrowleft": "Left",
          "arrowright": "Right",
          "arrowup": "Up",
          "arrowdown": "Down",
          space: "Space"
        };
        return map[value] || value.toUpperCase();
      }

      function isBindableKey(key) {
        const value = normalizeKey(key);
        if (!value) return false;
        if (value.length === 1) return /[a-z0-9]/.test(value);
        return [
          "enter",
          "space",
          "arrowleft",
          "arrowright",
          "arrowup",
          "arrowdown"
        ].includes(value);
      }

      function loadKeybinds() {
        try {
          const raw = window.localStorage.getItem(KEYBINDS_STORAGE_KEY);
          if (!raw) {
            keybinds = { ...defaultKeybinds };
            return;
          }
          const parsed = JSON.parse(raw);
          const next = { ...defaultKeybinds };
          Object.keys(defaultKeybinds).forEach((action) => {
            const candidate = normalizeKey(parsed && parsed[action]);
            if (candidate) {
              next[action] = candidate;
            }
          });
          keybinds = next;
        } catch {
          keybinds = { ...defaultKeybinds };
        }
      }

      function saveKeybinds() {
        try {
          window.localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(keybinds));
        } catch {
          // ignore storage errors
        }
      }

      function setKeybindStatus(message) {
        if (!keybindStatus) return;
        keybindStatus.textContent = message || "";
      }

      function refreshKeybindButtons() {
        Object.entries(keybindButtons).forEach(([action, button]) => {
          if (!button) return;
          const isEditing = activeRebindAction === action;
          button.textContent = isEditing ? "Press key..." : getKeyLabel(keybinds[action]);
          button.classList.toggle("is-listening", isEditing);
        });
      }

      function refreshActionKeyHints() {
        const get = (action, fallback) => getKeyLabel(keybinds[action] || fallback);
        const setHint = (selector, action, fallback) => {
          const button = document.querySelector(selector);
          if (!button) return;
          const label = get(action, fallback);
          const hint = button.querySelector(".action-key-hint");
          if (hint) hint.textContent = `(${label})`;
        };
        setHint("#stageMenuButton", "stageQuit", "q");
        setHint("#stageNextButton", "stageNext", "n");
        setHint("#stageRetryButton", "retry", "r");
        setHint("#practiceRetryButton", "retry", "r");
        setHint("#practiceBackButton", "practiceHome", "h");
        setHint("#practiceSettingsButton", "practiceSettings", "s");
      }

      function keybindMatches(event, action) {
        const pressed = normalizeKey(event.key);
        const expected = normalizeKey(keybinds[action] || defaultKeybinds[action]);
        return pressed && expected && pressed === expected;
      }

      window.getActionKeyLabel = function getActionKeyLabel(action) {
        if (!action) return "";
        return getKeyLabel(keybinds[action] || defaultKeybinds[action] || "");
      };

      function applyAppearance(theme, font, layout) {
        const nextTheme = appearanceOptions.themes.includes(theme) ? theme : appearanceOptions.themes[0];
        const nextFont = appearanceOptions.fonts.includes(font) ? font : appearanceOptions.fonts[0];
        const nextLayout = "classic";
        document.body.dataset.theme = nextTheme;
        document.body.dataset.font = nextFont;
        document.body.dataset.layout = nextLayout;
        if (appearanceTheme) appearanceTheme.value = nextTheme;
        if (appearanceFont) appearanceFont.value = nextFont;
        if (appearanceLayout) appearanceLayout.value = nextLayout;
      }

      function getStoredAppearance() {
        const savedTheme = window.localStorage.getItem(APPEARANCE_THEME_KEY);
        const savedFont = window.localStorage.getItem(APPEARANCE_FONT_KEY);
        const savedLayout = "classic";
        const fallbackTheme = appearanceOptions.themes.includes(defaultAppearance.theme)
          ? defaultAppearance.theme
          : appearanceOptions.themes[0];
        const fallbackFont = appearanceOptions.fonts.includes(defaultAppearance.font)
          ? defaultAppearance.font
          : appearanceOptions.fonts[0];
        const fallbackLayout = appearanceOptions.layouts.includes(defaultAppearance.layout)
          ? defaultAppearance.layout
          : appearanceOptions.layouts[0];
        return {
          theme: appearanceOptions.themes.includes(savedTheme) ? savedTheme : fallbackTheme,
          font: appearanceOptions.fonts.includes(savedFont) ? savedFont : fallbackFont,
          layout: appearanceOptions.layouts.includes(savedLayout) ? savedLayout : fallbackLayout
        };
      }

      function normalizeAudioVolume(value, fallbackValue) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallbackValue;
        return Math.max(0, Math.min(100, Math.round(numeric)));
      }

      function getStoredAudioSettings() {
        let savedMaster = null;
        let savedMusic = null;
        let savedEffects = null;
        try {
          savedMaster = window.localStorage.getItem(AUDIO_MASTER_KEY);
          savedMusic = window.localStorage.getItem(AUDIO_MUSIC_KEY);
          savedEffects = window.localStorage.getItem(AUDIO_EFFECTS_KEY);
        } catch {
          // ignore storage errors
        }
        return {
          master: normalizeAudioVolume(savedMaster, normalizeAudioVolume(defaultAudioSettings.master, 100)),
          music: normalizeAudioVolume(savedMusic, normalizeAudioVolume(defaultAudioSettings.music, 80)),
          effects: normalizeAudioVolume(savedEffects, normalizeAudioVolume(defaultAudioSettings.effects, 80))
        };
      }

      function setAudioSliderValue(labelEl, value) {
        if (!labelEl) return;
        labelEl.textContent = `${value}%`;
      }

      function emitAudioSettingsChanged() {
        const normalized = {
          master: audioSettings.master / 100,
          music: audioSettings.music / 100,
          effects: audioSettings.effects / 100
        };
        window.flashRecallAudioSettings = { ...normalized };
        window.dispatchEvent(
          new CustomEvent("audio-settings-changed", {
            detail: { ...normalized }
          })
        );
      }

      function applyAudioSettings(nextSettings, persist = false) {
        audioSettings = {
          master: normalizeAudioVolume(nextSettings.master, normalizeAudioVolume(defaultAudioSettings.master, 100)),
          music: normalizeAudioVolume(nextSettings.music, normalizeAudioVolume(defaultAudioSettings.music, 80)),
          effects: normalizeAudioVolume(nextSettings.effects, normalizeAudioVolume(defaultAudioSettings.effects, 80))
        };
        if (audioMasterVolume) audioMasterVolume.value = String(audioSettings.master);
        if (audioMusicVolume) audioMusicVolume.value = String(audioSettings.music);
        if (audioEffectsVolume) audioEffectsVolume.value = String(audioSettings.effects);
        setAudioSliderValue(audioMasterValue, audioSettings.master);
        setAudioSliderValue(audioMusicValue, audioSettings.music);
        setAudioSliderValue(audioEffectsValue, audioSettings.effects);

        if (persist) {
          try {
            window.localStorage.setItem(AUDIO_MASTER_KEY, String(audioSettings.master));
            window.localStorage.setItem(AUDIO_MUSIC_KEY, String(audioSettings.music));
            window.localStorage.setItem(AUDIO_EFFECTS_KEY, String(audioSettings.effects));
          } catch {
            // ignore storage errors
          }
        }
        emitAudioSettingsChanged();
      }

      window.getAudioMix = function getAudioMix() {
        return {
          master: audioSettings.master / 100,
          music: audioSettings.music / 100,
          effects: audioSettings.effects / 100
        };
      };
      let splashReturnToHome = false;
      let resetLoadingActive = false;

      function normalizePlayerName(raw) {
        if (raw === null || raw === undefined) return "";
        return String(raw).replace(/\s+/g, " ").trim().slice(0, 16);
      }

      function getPlayerName() {
        try {
          return normalizePlayerName(window.localStorage.getItem(PLAYER_NAME_KEY) || "");
        } catch {
          return "";
        }
      }

      function setPlayerName(name) {
        const normalized = normalizePlayerName(name);
        try {
          if (!normalized) {
            window.localStorage.removeItem(PLAYER_NAME_KEY);
            window.localStorage.removeItem(PLAYER_NAME_PROMPT_KEY);
          } else {
            window.localStorage.setItem(PLAYER_NAME_KEY, normalized);
          }
        } catch {
          // ignore storage errors
        }
        return normalized;
      }

      function updateLeaderboardNameForExistingTimes(newName) {
        if (!newName) return Promise.resolve();
        if (typeof window.updateStageLeaderboard !== "function") return Promise.resolve();
        const bestTimes = window.stageBestTimes || {};
        const entries = Object.entries(bestTimes);
        if (!entries.length) return Promise.resolve();
        const updates = [];
        entries.forEach(([key, value]) => {
          const match = String(key).match(/^(\\d+)_v(\\d+)$/);
          if (!match) return;
          const stageId = match[1];
          const stageVersion = Number(match[2]) || 1;
          const timeSeconds = Number(value);
          if (!Number.isFinite(timeSeconds)) return;
          updates.push(window.updateStageLeaderboard(stageId, stageVersion, timeSeconds, newName));
        });
        return Promise.all(updates).catch((error) => {
          console.warn("Failed to update leaderboard names", error);
        });
      }

      function updatePlayerNameInputs(value) {
        if (playerNameInput) {
          playerNameInput.value = value;
        }
        if (playerNameSetting) {
          playerNameSetting.value = value;
        }
        if (playerNameSave) {
          playerNameSave.disabled = !value;
        }
      }

      function closePlayerNameModal() {
        setModalState(playerNameModal, false);
        clearPlayerNameDelay();
        playerNameModalOpening = false;
      }

      function openPlayerNameModal() {
        playerNameModalOpening = true;
        window.setTimeout(() => {
          playerNameModalOpening = false;
        }, 450);
        setModalState(playerNameModal, true);
        const name = getPlayerName();
        updatePlayerNameInputs(name);
        if (playerNameInput) {
          playerNameInput.focus();
          playerNameInput.select();
        }
      }

      function shouldPromptForPlayerName() {
        if (!playerNameModal) return false;
        if (getPlayerName()) return false;
        try {
          return window.localStorage.getItem(PLAYER_NAME_PROMPT_KEY) !== "1";
        } catch {
          return true;
        }
      }

      function shouldShowPlayerNameSetting() {
        return true;
      }

      function updatePlayerNameSettingVisibility() {
        const row = document.getElementById("playerNameSettingRow");
        if (!row) return;
        if (shouldShowPlayerNameSetting()) row.removeAttribute("hidden");
      }

      function setSettingsTab(tabName) {
        if (!settingsModal) return;
        const tabButtons = settingsModal.querySelectorAll("[data-settings-tab]");
        const tabPanes = settingsModal.querySelectorAll("[data-settings-pane]");
        tabButtons.forEach((button) => {
          const isActive = button.getAttribute("data-settings-tab") === tabName;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        tabPanes.forEach((pane) => {
          const isActive = pane.getAttribute("data-settings-pane") === tabName;
          pane.classList.toggle("is-active", isActive);
          if (isActive) {
            pane.removeAttribute("hidden");
          } else {
            pane.setAttribute("hidden", "");
          }
        });
      }

      function markPlayerNamePrompted() {
        try {
          window.localStorage.setItem(PLAYER_NAME_PROMPT_KEY, "1");
        } catch {
          // ignore
        }
      }

      function shouldShowSplashScreen() {
        try {
          return window.localStorage.getItem(SPLASH_SEEN_KEY) !== "1";
        } catch {
          return true;
        }
      }

      function markSplashSeen() {
        try {
          window.localStorage.setItem(SPLASH_SEEN_KEY, "1");
        } catch {
          // ignore
        }
      }

      let splashStartListener = null;
      function attachSplashStartListeners() {
        if (splashStartListener) {
          return;
        }
        splashStartListener = (event) => {
          if (document.body.dataset.view !== "splash") return;
          window.removeEventListener("keydown", splashStartListener);
          window.removeEventListener("pointerdown", splashStartListener);
          splashStartListener = null;
          startFromSplash();
        };
        window.addEventListener("keydown", splashStartListener);
        window.addEventListener("pointerdown", splashStartListener);
      }



      let playerNamePromptDelayActive = false;
      let playerNamePromptDelayTimer = null;
      let playerNameModalOpening = false;

      function setResultInteractionsEnabled(enabled) {
        const value = enabled ? "" : "none";
        if (resultsPanel) {
          resultsPanel.style.pointerEvents = value;
        }
        if (actions) {
          actions.style.pointerEvents = value;
        }
      }

      function clearPlayerNameDelay() {
        if (playerNamePromptDelayTimer) {
          window.clearTimeout(playerNamePromptDelayTimer);
          playerNamePromptDelayTimer = null;
        }
        playerNamePromptDelayActive = false;
        setResultInteractionsEnabled(true);
      }

      window.getPlayerName = getPlayerName;
      window.setPlayerName = setPlayerName;
      window.maybePromptPlayerName = function maybePromptPlayerName() {
        if (!shouldPromptForPlayerName()) return;
        playerNamePromptDelayActive = true;
        setResultInteractionsEnabled(false);
        playerNamePromptDelayTimer = window.setTimeout(() => {
          playerNamePromptDelayTimer = null;
          try {
            if (!shouldPromptForPlayerName()) return;
            openPlayerNameModal();
          } finally {
            clearPlayerNameDelay();
          }
        }, 1200);
      };

      function resetGame() {
        bumpRoundFlowToken();
        if (successAnimationActive) {
          cancelSuccessAnimation();
        }
        clearFlashCountdown();
        if (typeof window.clearPreviousRoundItems === "function") {
          window.clearPreviousRoundItems();
        }
        clearInterval(timerId);
        timerId = null;
        if (stageTimerId) {
          clearInterval(stageTimerId);
          stageTimerId = null;
        }
        document.body.classList.remove("stage-fail");
        if (swapTimeoutId) {
          clearTimeout(swapTimeoutId);
          swapTimeoutId = null;
          swapStartTime = null;
          swapRemaining = null;
          swapStartRecall = null;
          swapCleanup = null;
        }
        pausedState = null;
        timerState = null;
        updatePlatformerVisibility(false);
        stopFog();
        stopGlitching();
        clearAdTimer();
        hideAd();
        round = 0;
        streak = 0;
        roundItems = [];
        roundItemsBase = [];
        updateScore();
        if (timerFill) {
          timerFill.style.width = "100%";
        }
        if (stageTimerHud) {
          stageTimerHud.textContent = "Time 0.00";
        }
        setPhase("Waiting to start", "idle");
        resetBoard();
        if (submitBtn) {
          submitBtn.disabled = true;
        }
        if (nextBtn) {
          nextBtn.disabled = true;
          nextBtn.textContent = "Next round";
        }
      }

      function resetForRetryRound() {
        bumpRoundFlowToken();
        if (successAnimationActive) {
          cancelSuccessAnimation();
        }
        clearFlashCountdown();
        if (typeof window.clearPreviousRoundItems === "function") {
          window.clearPreviousRoundItems();
        }
        clearInterval(timerId);
        timerId = null;
        document.body.classList.remove("stage-fail");
        if (swapTimeoutId) {
          clearTimeout(swapTimeoutId);
          swapTimeoutId = null;
          swapStartTime = null;
          swapRemaining = null;
          swapStartRecall = null;
          swapCleanup = null;
        }
        pausedState = null;
        timerState = null;
        updatePlatformerVisibility(false);
        stopFog();
        stopGlitching();
        clearAdTimer();
        hideAd();
        if (timerFill) {
          timerFill.style.width = "100%";
        }
        if (submitBtn) {
          submitBtn.disabled = true;
        }
        if (nextBtn) {
          nextBtn.disabled = true;
          nextBtn.textContent = "Next round";
        }
      }

      function openPracticeModal() {
        setModalState(practiceModal, true);
        const starsEl = document.getElementById("sandboxStars");
        if (starsEl && typeof window.getSandboxStarsAvailable === "function") {
          const availableEl = starsEl.querySelector(".sandbox-stars__available");
          const available = window.getSandboxStarsAvailable();
          if (availableEl) {
            availableEl.textContent = String(available);
          } else {
            starsEl.textContent = `✦ ${available}`;
          }
        }
        updateCategoryControls();
      }

      function closePracticeModal() {
        setModalState(practiceModal, false);
      }

      function isPracticeUnlocked() {
        if (window.unlockSandbox) return true;
        const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
        const unlockStageIndex = 4; // Stage 5 (0-based index)
        const unlockStage = stages[unlockStageIndex];
        const unlockKey = window.getStageStarsKey
          ? window.getStageStarsKey(unlockStage, unlockStageIndex)
          : (unlockStage && unlockStage.id ? String(unlockStage.id) : String(unlockStageIndex + 1));
        return Boolean(window.stageCompleted && window.stageCompleted[unlockKey]);
      }

      function updatePracticeLock() {
        const unlocked = isPracticeUnlocked();
        const wasUnlocked = updatePracticeLock.lastUnlocked;
        if (practiceStart) {
          practiceStart.disabled = !unlocked;
          practiceStart.classList.toggle("mode-card--locked", !unlocked);
          const lockText = practiceStart.querySelector(".mode-card__lock");
          if (lockText) {
            lockText.textContent = unlocked ? "" : "Locked • Clear Stage 5";
          }
          if (unlocked && wasUnlocked === false && lockText) {
            lockText.classList.remove("lock-fade");
            void lockText.offsetWidth;
            lockText.classList.add("lock-fade");
          }
        }
        updatePracticeLock.lastUnlocked = unlocked;
      }

      function formatStageModifiers(modifiers) {
        const entries = [
          { key: "mathOps", label: "Math ops" },
          { key: "mathOpsPlus", label: "Math ops+" },
          { key: "misleadColors", label: "Misleading colors" },
          { key: "backgroundColor", label: "Background color" },
          { key: "textColor", label: "Text color" },
          { key: "previousCard", label: "Previous card" },
          { key: "rotate", label: "Rotate" },
          { key: "rotatePlus", label: "Rotate+" },
          { key: "swapCards", label: "Card swap" },
          { key: "platformer", label: "Platformer" },
          { key: "glitch", label: "Glitch" },
          { key: "fog", label: "Fog" },
          { key: "blur", label: "Blur" },
          { key: "ads", label: "Ads" }
        ];
        const enabled = entries.filter((entry) => modifiers && modifiers[entry.key]).map((entry) => entry.label);
        return enabled.length ? enabled.join(", ") : "None";
      }

      let stageIntroPendingIndex = null;
      let stageIntroOriginEl = null;
      let flashStagePendingIndex = null;
      let flashCountdownTimers = [];
      let flashCountdownActive = false;
      let flashWarningEnabled = true;
      let tabTutorialShownRound = null;
      window.tabTutorialActive = false;
      let tabTutorialDisabledInputs = [];
      let tabTutorialHintEl = null;
      let tabTutorialHintTimeout = null;
      const tabTutorialStageIds = new Set([2, 3]);
      let firstLetterHintCooldown = 0;
      let firstLetterHintEl = null;
      let firstLetterHintTimeout = null;
      const firstLetterHintStageMessages = {
        5: "FIRST LETTER\n(Triangle -> T, Circle -> C, Square -> S)",
        6: "FIRST LETTER\n(Right -> R, Left -> L, Up -> U, ...)",
        7: "FIRST LETTER\n(White -> W, Red -> R, Blue -> B, ...)"
      };
      let stageListAnimTimeout = null;
      let stageListStarTimeout = null;
      let stageListAnimActive = false;
      let stageListMouseListenerAttached = false;
      let stageListSkipListener = null;
      let flashCountdownEnabled = true;
      let enterToNextEnabled = true;
      let stageStarShineInterval = null;
      

      function applyStageIntroOrigin(originEl) {
        if (!stageIntroModal || !stageIntroCard) return;
        stageIntroCard.classList.remove("intro-animate");
        stageIntroCard.style.removeProperty("--intro-from-x");
        stageIntroCard.style.removeProperty("--intro-from-y");
        stageIntroCard.style.removeProperty("--intro-from-scale");
        if (!originEl) {
          return;
        }
        const originRect = originEl.getBoundingClientRect();
        requestAnimationFrame(() => {
          if (!stageIntroModal.classList.contains("show")) return;
          const modalRect = stageIntroCard.getBoundingClientRect();
          if (!modalRect.width || !modalRect.height) return;
          const originCenterX = originRect.left + originRect.width / 2;
          const originCenterY = originRect.top + originRect.height / 2;
          const modalCenterX = modalRect.left + modalRect.width / 2;
          const modalCenterY = modalRect.top + modalRect.height / 2;
          const dx = originCenterX - modalCenterX;
          const dy = originCenterY - modalCenterY;
          const scale = Math.min(originRect.width / modalRect.width, originRect.height / modalRect.height, 1);
          stageIntroCard.style.setProperty("--intro-from-x", `${dx}px`);
          stageIntroCard.style.setProperty("--intro-from-y", `${dy}px`);
          stageIntroCard.style.setProperty("--intro-from-scale", `${Math.max(0.6, scale)}`);
          stageIntroCard.classList.remove("intro-animate");
          void stageIntroCard.offsetWidth;
          stageIntroCard.classList.add("intro-animate");
        });
      }

      function closeStageIntro() {
        stageIntroPendingIndex = null;
        stageIntroOriginEl = null;
        if (stageIntroCard) {
          stageIntroCard.classList.remove("intro-animate");
          stageIntroCard.style.removeProperty("--intro-from-x");
          stageIntroCard.style.removeProperty("--intro-from-y");
          stageIntroCard.style.removeProperty("--intro-from-scale");
        }
        setModalState(stageIntroModal, false);
      }

      function clearFlashCountdown() {
        flashCountdownActive = false;
        flashCountdownTimers.forEach((timerId) => clearTimeout(timerId));
        flashCountdownTimers = [];
        if (flashCountdown) {
          flashCountdown.classList.remove("show");
          flashCountdown.setAttribute("aria-hidden", "true");
        }
        document.body.classList.remove("flash-countdown-active");
      }

function runFlashCountdown(onComplete) {
        if (flashCountdownActive) {
          return;
        }
        if (!flashCountdownEnabled) {
          if (typeof onComplete === "function") onComplete();
          return;
        }
        if (!flashCountdown) {
          if (typeof onComplete === "function") onComplete();
          return;
        }
        clearFlashCountdown();
        flashCountdownActive = true;
        document.body.classList.add("flash-countdown-active");
        const label = flashCountdown.querySelector(".flash-countdown__num");
        const steps = ["3", "2", "1"];
        const durationMs = 1000;
        const stepInterval = durationMs / steps.length;
        const countdownStart = performance.now();
        if (gameMode === "stages" && stageState && stageState.active) {
          stopStageStopwatch();
        }
        flashCountdown.classList.add("show");
        flashCountdown.removeAttribute("aria-hidden");
        steps.forEach((value, index) => {
          const timerId = window.setTimeout(() => {
            if (label) {
              label.textContent = value;
            }
          }, Math.floor(index * stepInterval));
          flashCountdownTimers.push(timerId);
        });
        const finishId = window.setTimeout(() => {
          flashCountdownActive = false;
          clearFlashCountdown();
          if (gameMode === "stages" && stageState && typeof stageState.startTime === "number") {
            stageState.startTime += performance.now() - countdownStart;
            if (!document.body.classList.contains("pause-active")) {
              startStageStopwatch();
            }
          }
          if (typeof onComplete === "function") onComplete();
        }, durationMs);
        flashCountdownTimers.push(finishId);
      }

      function startFlashRound() {
        runFlashCountdown(() => {
          startRound({ advanceRound: true, __flashOverride: true });
        });
      }

      window.startFlashRound = startFlashRound;

      function openFlashStagePrompt(index) {
        if (!flashWarningEnabled) {
          return;
        }
        flashStagePendingIndex = index;
        setModalState(flashStageModal, true);
      }

      function closeFlashStagePrompt() {
        flashStagePendingIndex = null;
        setModalState(flashStageModal, false);
      }

      function openStageIntro(index, originEl = null) {
        if (!stageIntroModal || !stageIntroTitle || !stageIntroList) return false;
        const stage = window.getStageConfig ? window.getStageConfig(index) : null;
        if (!stage) return false;
        if (!window.__stageIntroWarmed && stageIntroModal) {
          window.__stageIntroWarmed = true;
          stageIntroModal.style.visibility = "hidden";
          stageIntroModal.style.display = "grid";
          stageIntroModal.offsetHeight;
          stageIntroModal.style.display = "";
          stageIntroModal.style.visibility = "";
        }
        const stageName = stage.name ? String(stage.name) : `Stage ${index + 1}`;
        stageIntroTitle.textContent = stageName;
        if (stageIntroStars) {
          stageIntroStars.innerHTML = "";
          const stageKey = window.getStageStarsKey
            ? window.getStageStarsKey(stage, index)
            : (stage && stage.id ? String(stage.id) : String(index + 1));
          const starsEarned = window.stageStars && window.stageStars[stageKey] ? window.stageStars[stageKey] : 0;
          [1, 2, 3].forEach((value) => {
            const star = document.createElement("span");
            star.className = `stage-star${starsEarned >= value ? " is-filled" : ""}`;
            star.textContent = "✦";
            stageIntroStars.appendChild(star);
          });
          if (starsEarned >= 4) {
            const secret = document.createElement("span");
            secret.className = "stage-star is-filled is-secret";
            secret.textContent = "✦";
            stageIntroStars.appendChild(secret);
          }
        }
        if (stageIntroBest) {
          const bestKey = window.getStageBestTimeKey
            ? window.getStageBestTimeKey(stage, index)
            : (stage && stage.id ? String(stage.id) : String(index + 1));
          const bestSeconds = Number(window.stageBestTimes && window.stageBestTimes[bestKey]);
          stageIntroBest.textContent = Number.isFinite(bestSeconds)
            ? `Best: ${bestSeconds.toFixed(2)}s`
            : "Best: —";
        }
        if (stageIntroSubtitle) {
          const rounds = stage.rounds || 1;
          const cards = window.getStageCardCount ? window.getStageCardCount(stage) : stage.cards || 1;
          const revealSeconds = Number(stage.revealSeconds) || Number(revealInput.value) || 5;
          const recallSeconds = Number(stage.recallSeconds) || Number(recallInput.value) || 5;
          stageIntroSubtitle.innerHTML = "";
          const chips = [
            { label: "Rounds", value: rounds },
            { label: "Cards", value: cards },
            { label: "Reveal", value: `${revealSeconds}s` },
            { label: "Recall", value: `${recallSeconds}s` }
          ];
          chips.forEach((chip) => {
            const pill = document.createElement("span");
            pill.className = "stage-intro-chip";
            pill.textContent = chip.label;
            pill.dataset.value = chip.value;
            stageIntroSubtitle.appendChild(pill);
          });
        }
        if (stageIntroGoals) {
          stageIntroGoals.innerHTML = "";
        }
        stageIntroList.innerHTML = "";
        const categories = window.getStageCategories ? window.getStageCategories(stage) : stage.categories || [];
        const modifiers = window.getStageModifiers ? window.getStageModifiers(stage) : stage.modifiers || {};
        const glitchSvg =
          '<svg class="glitch-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">' +
          '<rect class="glitch-card-fill" x="6" y="6" width="52" height="52" rx="8" fill="#ffffff" stroke="#111111" stroke-width="3"/>' +
          '<text x="32" y="42" text-anchor="middle" font-family="\'Arial Black\', sans-serif" font-size="28" fill="#111">7</text>' +
          "</svg>";
        const cardIconMap = {
          numbers: { label: "Numbers", src: "imgs/icons/card-numbers.svg" },
          colors: { label: "Colors", src: "imgs/icons/card-colors.svg" },
          letters: { label: "Letters", src: "imgs/icons/card-letters.svg" },
          directions: { label: "Directions", src: "imgs/icons/card-directions.svg" },
          diagonal: { label: "Diagonal", src: "imgs/icons/card-diagonal.svg" },
          shapes: { label: "Shapes", src: "imgs/icons/card-shapes.svg" },
          fruits: { label: "Fruits", src: "imgs/apple.png" }
        };
        const modifierIconMap = {
          mathOps: { label: "Math ops", src: "imgs/icons/mod-mathops.svg" },
          mathOpsPlus: { label: "Math ops+", src: "imgs/icons/mod-mathopsplus.svg" },
          misleadColors: { label: "Mislead", src: "imgs/icons/mod-misleadcolors.svg" },
          backgroundColor: { label: "Background", src: "imgs/icons/mod-backgroundcolor.svg" },
          textColor: { label: "Text color", src: "imgs/icons/mod-textcolor.svg" },
          previousCard: { label: "Previous", src: "imgs/icons/mod-previouscard.svg" },
          rotate: { label: "Rotate", src: "imgs/icons/mod-rotate.svg" },
          rotatePlus: { label: "Rotate+", src: "imgs/icons/mod-rotateplus.svg" },
          swapCards: { label: "Swap", src: "imgs/icons/mod-swapcards.svg" },
          platformer: { label: "Platformer", src: "imgs/icons/mod-platformer.svg" },
          glitch: { label: "Glitch", inlineSvg: glitchSvg },
          fog: { label: "Fog", src: "imgs/icons/mod-fog.svg" },
          blur: { label: "Blur", src: "imgs/icons/mod-blur.svg" },
          ads: { label: "Ads", src: "imgs/icons/mod-ads.svg" }
        };
        const renderIconSection = (title, items) => {
          const section = document.createElement("div");
          section.className = "stage-intro-section-block";
          const heading = document.createElement("div");
          heading.className = "stage-intro-section";
          heading.textContent = title;
          const grid = document.createElement("div");
          grid.className = "stage-intro-icon-grid";
          items.forEach((item) => {
            const tile = document.createElement("div");
            tile.className = "stage-intro-icon";
            let visual;
            if (item.inlineSvg) {
              const wrapper = document.createElement("span");
              wrapper.innerHTML = item.inlineSvg;
              visual = wrapper.firstElementChild;
            } else {
              const img = document.createElement("img");
              img.src = item.src;
              img.alt = item.label;
              img.loading = "lazy";
              if (item.className) {
                img.classList.add(item.className);
              }
              visual = img;
            }
            const label = document.createElement("span");
            label.textContent = item.label;
            tile.appendChild(visual);
            tile.appendChild(label);
            grid.appendChild(tile);
          });
          section.appendChild(heading);
          section.appendChild(grid);
          stageIntroList.appendChild(section);
        };
        const categoryKeys = categories.length ? categories : ["numbers"];
        const cardItems = categoryKeys
          .map((key) => cardIconMap[key])
          .filter(Boolean);
        renderIconSection("Card Types", cardItems);
        const modifierItems = Object.keys(modifierIconMap)
          .filter((key) => modifiers && modifiers[key])
          .map((key) => modifierIconMap[key]);
        if (modifierItems.length) {
          renderIconSection("Modifiers", modifierItems);
        }
        stageIntroPendingIndex = index;
        if (leaderboardOpen) {
          leaderboardOpen.dataset.stageIndex = String(index);
        }
        stageIntroOriginEl = originEl;
        setModalState(stageIntroModal, true);
        applyStageIntroOrigin(stageIntroOriginEl);
        return true;
      }

      function hasAnyStageCompletion(stage, index) {
        if (!window.stageCompleted) return false;
        const stageId = stage && stage.id ? String(stage.id) : String(index + 1);
        const currentKey = window.getStageStarsKey
          ? window.getStageStarsKey(stage, index)
          : stageId;
        if (window.stageCompleted[currentKey]) return true;
        const prefix = `${stageId}_v`;
        return Object.keys(window.stageCompleted).some(
          (key) => key.startsWith(prefix) && window.stageCompleted[key]
        );
      }

      function isStageUnlocked(stageIndex) {
        if (window.unlockAllStages) return true;
        if (window.lockAllStagesExceptFirst) return stageIndex === 0;
        // Stage 1 (first stage) is always unlocked
        if (stageIndex === 0) return true;

        const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
        if (!stages.length) return false;
        if (!window.stageCompleted) {
          window.stageCompleted = {};
        }

        // If the previous stage is completed, keep it unlocked (default progression).
        const prevStage = stages[stageIndex - 1];
        if (prevStage && hasAnyStageCompletion(prevStage, stageIndex - 1)) {
          return true;
        }

        // Tutorial unlock rule:
        // completing a tutorial stage unlocks all stages up to and including the next tutorial stage.
        const tutorialIndices = stages
          .map((stage, index) => (String(stage.stageType).toLowerCase() === "tutorial" ? index : null))
          .filter((index) => Number.isFinite(index));
        if (!tutorialIndices.length) return false;

        for (let i = 0; i < tutorialIndices.length; i += 1) {
          const tIndex = tutorialIndices[i];
          const tutorialStage = stages[tIndex];
          if (!hasAnyStageCompletion(tutorialStage, tIndex)) continue;
          const nextTutorialIndex = tutorialIndices[i + 1] ?? stages.length - 1;
          if (stageIndex > tIndex && stageIndex <= nextTutorialIndex) {
            return true;
          }
        }

        return false;
      }

      function renderStageList(animate = false) {
        if (!stageList) return;
        if (!window.stageNewSeen) {
          window.stageNewSeen = {};
        }
        stageListAnimActive = false;
        stageListMouseListenerAttached = false;
        if (stageListSkipListener) {
          window.removeEventListener("mousemove", stageListSkipListener);
          stageListSkipListener = null;
        }
        if (stageListAnimTimeout) {
          clearTimeout(stageListAnimTimeout);
          stageListAnimTimeout = null;
        }
        if (stageListStarTimeout) {
          clearTimeout(stageListStarTimeout);
          stageListStarTimeout = null;
        }
        const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
        const pageSize = 20;
        const totalPages = Math.max(1, Math.ceil(stages.length / pageSize));
        stageState.page = Math.max(0, Math.min(stageState.page || 0, totalPages - 1));
        const lockIconSrc = "imgs/lock.png";
        const stagesTotal = document.getElementById("stagesTotal");
        const stagesProgress = document.getElementById("stagesProgress");
        if (stagesTotal || stagesProgress) {
          const totalStars = stages.reduce((sum, stage, index) => {
            const stageKey = window.getStageStarsKey
              ? window.getStageStarsKey(stage, index)
              : (stage && stage.id ? String(stage.id) : String(index + 1));
            return sum + (window.stageStars && window.stageStars[stageKey] ? window.stageStars[stageKey] : 0);
          }, 0);
          const completedCount = stages.reduce((sum, stage, index) => {
            const stageKey = window.getStageStarsKey
              ? window.getStageStarsKey(stage, index)
              : (stage && stage.id ? String(stage.id) : String(index + 1));
            return sum + (window.stageCompleted && window.stageCompleted[stageKey] ? 1 : 0);
          }, 0);
          if (stagesTotal) {
            stagesTotal.innerHTML = `<span class="stage-total__stars">✦</span><span class="stage-total__count">${totalStars}</span>`;
          }
          if (stagesProgress) {
            stagesProgress.innerHTML = `<span class="stage-progress__label stage-progress__label--check">✓</span><span class="stage-progress__count">${completedCount}/${stages.length}</span>`;
          }
        }
        if (!stages.length) {
          stageList.innerHTML = "<div class=\"stage-meta\">No stages configured yet.</div>";
          return;
        }
        const pageStart = stageState.page * pageSize;
        const pageStages = stages.slice(pageStart, pageStart + pageSize);
        stageList.classList.add("stage-list--hidden");
        stageList.innerHTML = pageStages
          .map((stage, offset) => {
            const index = pageStart + offset;
            const stageKey = window.getStageStarsKey
              ? window.getStageStarsKey(stage, index)
              : (stage && stage.id ? String(stage.id) : String(index + 1));
            const completionKey = window.getStageStarsKey
              ? window.getStageStarsKey(stage, index)
              : (stage && stage.id ? String(stage.id) : String(index + 1));
            const stars = window.stageStars && window.stageStars[stageKey] ? window.stageStars[stageKey] : 0;
            const bestKey = window.getStageBestTimeKey
              ? window.getStageBestTimeKey(stage, index)
              : stageKey;
            const bestTimeSeconds = Number(
              window.stageBestTimes && window.stageBestTimes[bestKey]
            );
            const isCompleted = window.stageCompleted && window.stageCompleted[completionKey];
            const stageType = stage && stage.stageType ? String(stage.stageType).toLowerCase() : "";
            const stageTypeIcon =
              stageType === "flash"
                ? { src: "imgs/flash_icon.png", label: "Flash level" }
                : stageType === "tutorial"
                  ? { src: "imgs/tutorial_icon.png", label: "Tutorial level" }
                  : null;

            const starsMarkup = [1, 2, 3]
              .map((value) => {
                const filled = stars >= value ? " is-filled" : "";
                return `<span class="stage-star${filled}">✦</span>`;
              })
              .join("");
            const secretStarMarkup = stars >= 4 ? `<span class="stage-star is-filled is-secret">✦</span>` : "";

            const name = stage && stage.id ? String(stage.id) : String(index + 1);
            const unlocked = isStageUnlocked(index);
            const lockedClass = unlocked ? "" : " stage-card--locked";
            const lockedAttr = unlocked ? "" : " disabled";
            const lockIcon = unlocked
              ? ""
              : lockIconSrc
                ? `<img class="stage-lock" src="${lockIconSrc}" alt="" />`
                : "";
            const attempted = isCompleted || stars > 0 || Number.isFinite(bestTimeSeconds);
            const showProgress = unlocked && attempted;
            const unlockedUnattempted = unlocked && !attempted;
            const isNew = unlockedUnattempted && index !== 0 && !window.stageNewSeen[stageKey];
            const lockedLabel = !unlocked
              ? ""
              : isNew
                ? `<div class="stage-meta stage-locked stage-new">New</div>`
                : "";
            const placeholderStars =
              `<div class="stage-meta stage-stars stage-meta--placeholder" aria-hidden="true">` +
              `<span class="stage-star">✦</span><span class="stage-star">✦</span><span class="stage-star">✦</span>` +
              `</div>`;
            const placeholderBest = `<div class="stage-meta stage-best stage-meta--placeholder" aria-hidden="true"></div>`;

            if (unlockedUnattempted) {
              window.stageNewSeen[stageKey] = true;
            }

            return `
              <button class="stage-card stage-card--clickable${lockedClass}" type="button" data-stage-index="${index}" data-anim-index="${offset}" data-anim-state="pending"${lockedAttr}>
                ${unlocked ? `<strong>${name}</strong>` : ""}
                ${lockIcon}
                ${lockedLabel}
                ${
                  showProgress
                    ? `<div class="stage-meta stage-stars">${starsMarkup}${secretStarMarkup}</div>`
                    : unlockedUnattempted
                      ? `<div class="stage-meta stage-stars">${starsMarkup}</div>`
                      : placeholderStars
                }
                ${placeholderBest}
                ${unlocked && stageTypeIcon ? `<img class="stage-type-icon" src="${stageTypeIcon.src}" alt="${stageTypeIcon.label}" />` : ""}
              </button>
            `;
          })
          .join("");
        if (stagesFooter) {
          stagesFooter.textContent =
            totalPages > 1 ? `Page ${stageState.page + 1} / ${totalPages}` : "";
        }
        if (stagesNext) {
          stagesNext.style.display = totalPages > 1 ? "inline-flex" : "none";
        }
        if (stagesPrev) {
          stagesPrev.style.display = totalPages > 1 ? "inline-flex" : "none";
        }
        if (animate) {
          stageList.classList.add("stage-list--hidden");
          stageListAnimActive = true;
          const headerDelayMs = 280;
          stageListSkipListener = () => {
            if (!stageListAnimActive || !stageList) return;
            if (stageListAnimTimeout) {
              clearTimeout(stageListAnimTimeout);
              stageListAnimTimeout = null;
            }
            if (stageListStarTimeout) {
              clearTimeout(stageListStarTimeout);
              stageListStarTimeout = null;
            }
            stageListAnimActive = false;
            stageListMouseListenerAttached = false;
            stageList.classList.remove("stage-list--hidden");
            const pendingCards = Array.from(
              stageList.querySelectorAll('.stage-card[data-anim-state="pending"]')
            );
            pendingCards.forEach((card) => {
              card.dataset.animState = "done";
              card.classList.remove("stage-card--animate");
              card.classList.remove("stage-card--fadein");
            });
            void stageList.offsetWidth;
            pendingCards.forEach((card) => {
              card.classList.add("stage-card--fadein");
            });
            const pendingCount = pendingCards.length;
            const fadeDelay = 240;
            stageListStarTimeout = window.setTimeout(() => {
              stageList
                .querySelectorAll(".stage-stars")
                .forEach((stars) => {
                  stars.classList.remove("stage-stars--shine");
                  void stars.offsetWidth;
                  stars.classList.add("stage-stars--shine");
                });
            }, pendingCount ? fadeDelay : 0);
            if (stageListSkipListener) {
              window.removeEventListener("mousemove", stageListSkipListener);
              stageListSkipListener = null;
            }
          };
          if (!stageListMouseListenerAttached) {
            stageListMouseListenerAttached = true;
            window.addEventListener("mousemove", stageListSkipListener);
          }
          requestAnimationFrame(() => {
            stageListAnimTimeout = window.setTimeout(() => {
              stageList.classList.remove("stage-list--hidden");
              stageList.querySelectorAll(".stage-card").forEach((card, idx) => {
                const animIndex = Number(card.dataset.animIndex);
                const delay = Number.isFinite(animIndex) ? animIndex : idx;
                card.style.setProperty("--stage-anim-delay", `${delay * 100}ms`);
                card.dataset.animState = "pending";
                card.classList.remove("stage-card--animate");
                void card.offsetWidth;
                card.classList.add("stage-card--animate");
                const onStart = (event) => {
                  if (event.animationName !== "stageCardPop") return;
                  card.dataset.animState = "animating";
                  card.removeEventListener("animationstart", onStart);
                };
                const onEnd = (event) => {
                  if (event.animationName !== "stageCardPop") return;
                  card.dataset.animState = "done";
                  card.removeEventListener("animationend", onEnd);
                };
                card.addEventListener("animationstart", onStart);
                card.addEventListener("animationend", onEnd);
              });
              const cards = stageList.querySelectorAll(".stage-card");
              const maxIndex = Math.max(0, cards.length - 1);
              const totalDelay = headerDelayMs + maxIndex * 100;
              stageListStarTimeout = window.setTimeout(() => {
                stageListAnimActive = false;
                stageList
                  .querySelectorAll(".stage-stars")
                  .forEach((stars) => {
                    stars.classList.remove("stage-stars--shine");
                    void stars.offsetWidth;
                    stars.classList.add("stage-stars--shine");
                  });
                if (stageListSkipListener) {
                  window.removeEventListener("mousemove", stageListSkipListener);
                  stageListSkipListener = null;
                }
              }, totalDelay);
            }, headerDelayMs);
          });
        } else {
          stageListMouseListenerAttached = false;
          if (stageListSkipListener) {
            window.removeEventListener("mousemove", stageListSkipListener);
            stageListSkipListener = null;
          }
          stageList.classList.remove("stage-list--hidden");
          stageList.querySelectorAll(".stage-card").forEach((card) => {
            card.classList.remove("stage-card--animate");
            card.classList.remove("stage-card--fadein");
            card.dataset.animState = "done";
            card.style.removeProperty("--stage-anim-delay");
          });
          stageList.querySelectorAll(".stage-stars").forEach((stars) => {
            stars.classList.remove("stage-stars--shine");
          });
        }
      }
      
      function startStarShineLoop() {
        if (stageStarShineInterval) { 
          clearInterval(stageStarShineInterval);
        }
        stageStarShineInterval = setInterval(() => {
          if (document.body.dataset.view !== "stages") return;
          const starsElements = document.querySelectorAll(".stage-list .stage-stars");
          starsElements.forEach((stars) => {
            stars.classList.remove("stage-stars--shine");
            void stars.offsetWidth;
            stars.classList.add("stage-stars--shine");
          });
        }, 5000);
      }

      function openStagesScreen(animate = false) {
        if (stagesScreen) {
          stagesScreen.classList.remove("stages-anim");
          if (animate) {
            void stagesScreen.offsetWidth;
            stagesScreen.classList.add("stages-anim");
          }
        }
        renderStageList(animate);
        if (stagesScreen) {
          stagesScreen.removeAttribute("aria-hidden");
        }
        document.body.dataset.view = "stages";
        startStarShineLoop();
      }

      function closeStagesScreen(animateHome = true) {
        if (stageStarShineInterval) {
          clearInterval(stageStarShineInterval);
          stageStarShineInterval = null;
        }
        if (stagesScreen) {
          stagesScreen.setAttribute("aria-hidden", "true");
        }
        document.body.dataset.view = "home";
        clearFirstLetterHint();
        clearFlashCountdown();
        if (animateHome) {
          document.body.classList.remove("home-anim");
          void document.body.offsetWidth;
          document.body.classList.add("home-anim");
        } else {
          document.body.classList.remove("home-anim");
        }
        updatePracticeLock();
      }

      function openSplashScreen() {
        if (splashScreen) {
          splashScreen.removeAttribute("aria-hidden");
        }
        if (mainHeader) {
          mainHeader.setAttribute("aria-hidden", "true");
          mainHeader.style.display = "none";
        }
        document.body.dataset.view = "splash";
      }

      function closeSplashScreen() {
        if (splashScreen) {
          splashScreen.setAttribute("aria-hidden", "true");
        }
        if (mainHeader) {
          mainHeader.removeAttribute("aria-hidden");
          mainHeader.style.display = "";
        }
        if (document.body.dataset.view === "splash") {
          document.body.dataset.view = "home";
        }
      }

      function openSplashLoading(message = null) {
        document.body.classList.add("loading-overlay");
        document.body.classList.remove("home-anim");
        if (splashLoading) {
          const textEl = splashLoading.querySelector(".splash-loading__text");
          if (textEl) {
            const nextMessage = message || (resetLoadingActive ? "Resetting…" : "Loading…");
            textEl.textContent = nextMessage;
          }
          splashLoading.removeAttribute("aria-hidden");
        }
        if (mainHeader) {
          mainHeader.setAttribute("aria-hidden", "true");
          mainHeader.style.display = "none";
        }
        document.body.dataset.view = "loading";
      }

      function closeSplashLoading(skipViewReset = false, keepHeaderHidden = false) {
        document.body.classList.remove("loading-overlay");
        if (splashLoading) {
          splashLoading.setAttribute("aria-hidden", "true");
        }
        if (!keepHeaderHidden && mainHeader) {
          mainHeader.removeAttribute("aria-hidden", "true");
          mainHeader.style.display = "";
        }
        if (!skipViewReset && document.body.dataset.view === "loading") {
          document.body.dataset.view = "home";
        }
      }

      function triggerHomeFadeIn() {
        document.body.classList.remove("home-anim");
        void document.body.offsetWidth;
        document.body.classList.add("home-anim");
      }

      function showSplashAfterLoading() {
        openSplashScreen();
        attachSplashStartListeners();
        window.requestAnimationFrame(() => {
          closeSplashLoading(true, true);
          document.body.classList.remove("resetting");
          resetConfirmYes.disabled = false;
          resetLoadingActive = false;
        });
      }



      function startStage(index, options = {}) {
        const {
          skipIntro = false,
          originEl = null,
          deferStartRound = false,
          skipFlashWarningPrompt = false
        } = options;
        tabTutorialShownRound = null;
        tabTutorialActive = false;
        firstLetterHintCooldown = 0;
        clearTabKeyHint();
        clearFirstLetterHint();
        clearFlashCountdown();
        const stage = window.getStageConfig ? window.getStageConfig(index) : null;
        const isFlashStage = stage && String(stage.stageType).toLowerCase() === "flash";
        if (isFlashStage && flashWarningEnabled && !skipFlashWarningPrompt && skipIntro) {
          openFlashStagePrompt(index);
          return;
        }
        if (!skipIntro && openStageIntro(index, originEl)) {
          return;
        }
        if (stage && typeof window.ensureStageLeaderboardSessionCache === "function") {
          const stageId = stage.id ? String(stage.id) : String(index + 1);
          const stageVersion = window.getStageVersion ? window.getStageVersion(stage) : 1;
          window.ensureStageLeaderboardSessionCache(stageId, stageVersion).catch((error) => {
            console.warn("Stage leaderboard prefetch failed", error);
          });
        }
        stageState.active = false;
        stageState.index = index;
        stageState.startTime = performance.now();
        stageState.elapsedMs = 0;
        stageState.completed = false;
        stageState.failed = false;
        stageState.lastStars = 0;
        modeSelect.value = "stages";
        updateModeUI();
        resetGame();
        closeStagesScreen(false);
        if (deferStartRound) {
          setPhase("Get ready", "show");
          return;
        }
        startRound({ advanceRound: true });
      }

      async function startFromSplash() {
        if (splashReturnToHome) {
          splashReturnToHome = false;
          closeSplashScreen();
          markSplashSeen();
          document.body.dataset.view = "home";
          if (mainHeader) {
            mainHeader.removeAttribute("aria-hidden");
            mainHeader.style.display = "";
          }
          triggerHomeFadeIn();
          return;
        }
        closeSplashScreen();
        markSplashSeen();
        openSplashLoading();
        const minimumDelay = new Promise((resolve) => {
          window.setTimeout(resolve, 750);
        });
        const fontsReady = document.fonts && document.fonts.ready
          ? document.fonts.ready
          : Promise.resolve();
        await Promise.all([minimumDelay, fontsReady]).catch(() => {});
        closeSplashLoading();
        startStage(0, { skipIntro: true });
      }

      practiceStart.addEventListener("click", () => {
        if (!isPracticeUnlocked()) return;
        openPracticeModal();
      });

      if (referenceOpen) {
        referenceOpen.addEventListener("click", () => {
          setModalState(referenceModal, true);
        });
      }

      if (referenceClose) {
        referenceClose.addEventListener("click", () => {
          setModalState(referenceModal, false);
        });
      }

      if (referenceModal) {
        referenceModal.addEventListener("click", (event) => {
          if (event.target === referenceModal) {
            setModalState(referenceModal, false);
          }
        });
      }
      if (stageIntroClose && stageIntroModal) {
        stageIntroClose.addEventListener("click", () => {
          closeStageIntro();
        });
      }
      if (leaderboardOpen && leaderboardModal) {
        leaderboardOpen.addEventListener("click", async () => {
          setModalState(leaderboardModal, true);
          if (typeof window.syncLocalBestTimesOnce === "function") {
            try {
              await window.syncLocalBestTimesOnce(false);
            } catch (error) {
              console.warn("Leaderboard sync failed", error);
            }
          }
          if (typeof window.renderStageLeaderboard === "function") {
            const rawIndex = leaderboardOpen.dataset.stageIndex ?? stageIntroPendingIndex;
            const index = Number.isFinite(Number(rawIndex)) ? Number(rawIndex) : stageIntroPendingIndex;
            const stage = Number.isFinite(index) && window.getStageConfig ? window.getStageConfig(index) : null;
            if (stage) {
              window.renderStageLeaderboard(stage, index, "leaderboardModalList", "leaderboardModalEmpty");
            }
          }
        });
      }
      if (leaderboardClose && leaderboardModal) {
        leaderboardClose.addEventListener("click", () => {
          setModalState(leaderboardModal, false);
        });
      }
      if (leaderboardModal) {
        leaderboardModal.addEventListener("click", (event) => {
          if (event.target === leaderboardModal) {
            setModalState(leaderboardModal, false);
          }
        });
      }
      window.renderStageLeaderboard = async function renderStageLeaderboard(stage, index, listId, emptyId) {
        const listEl = document.getElementById(listId);
        const emptyEl = document.getElementById(emptyId);
        if (!listEl) return;
        const truncateLeaderboardName = (value) => {
          const text = value ? String(value) : "";
          return text.length > 16 ? text.slice(0, 16) : text;
        };
        const stageId = stage && stage.id ? String(stage.id) : String(index + 1);
        const stageVersion = window.getStageVersion ? window.getStageVersion(stage) : 1;
        listEl.dataset.stageId = stageId;
        listEl.dataset.stageVersion = String(stageVersion);
        const retryCount = Number(listEl.dataset.lbRetryCount || 0);
        const snapshot = typeof window.getLoggingDebugSnapshot === "function"
          ? window.getLoggingDebugSnapshot()
          : null;
        const headerRow = document.createElement("div");
        headerRow.className = "leaderboard-row";
        headerRow.innerHTML = "<span>#</span><span>Player</span><span>Time</span>";
        const loadingRow = document.createElement("div");
        loadingRow.className = "leaderboard-row leaderboard-row--empty";
        loadingRow.textContent = "Loading…";
        listEl.replaceChildren(headerRow, loadingRow);
        const leaderboardReady = typeof window.getLeaderboardReady === "function"
          ? window.getLeaderboardReady()
          : true;
        if (typeof window.fetchStageLeaderboard !== "function" || (snapshot && !snapshot.ready && !leaderboardReady)) {
          if (retryCount < 5) {
            listEl.dataset.lbRetryCount = String(retryCount + 1);
            window.setTimeout(() => {
              window.renderStageLeaderboard(stage, index, listId, emptyId);
            }, 600);
          } else if (emptyEl) {
            loadingRow.textContent = "No data yet";
          }
          return;
        }
        listEl.dataset.lbRetryCount = "0";
        try {
          const result = await window.fetchStageLeaderboard(stageId, stageVersion, 5);
          const top = result && Array.isArray(result.top) ? result.top : [];
          const me = result ? result.me : null;
          const fetchedMeRank = result ? result.meRank : null;
          const rows = [];
          const localName = typeof window.getPlayerName === "function" ? window.getPlayerName() : "";
          let meEntry = null;
          let meRank = Number.isFinite(fetchedMeRank) ? fetchedMeRank : null;
          (Array.isArray(top) ? top : []).forEach((entry, idx) => {
            const row = document.createElement("div");
            row.className = "leaderboard-row leaderboard-row--data";
            if (entry.player_id && window.getLeaderboardPlayerId && entry.player_id === window.getLeaderboardPlayerId()) {
              row.classList.add("leaderboard-row--me-top");
              meEntry = entry;
              meRank = idx + 1;
            }
            const time = Number(entry.best_time_ms);
            const timeText = Number.isFinite(time) ? `${(time / 1000).toFixed(2)}s` : "—";
            const isMe =
              entry.player_id && window.getLeaderboardPlayerId && entry.player_id === window.getLeaderboardPlayerId();
            const rawName = isMe && localName ? localName : (entry.player_name || `Player ${entry.player_id || "?"}`);
            const name = truncateLeaderboardName(rawName);
            row.dataset.playerId = entry.player_id || "";
            row.innerHTML = `<span>${idx + 1}</span><span class="leaderboard-name" title="${rawName}">${name}</span><span>${timeText}</span>`;
            rows.push(row);
          });
          if (meEntry || me) {
            const source = meEntry || me;
            const row = document.createElement("div");
            row.className = "leaderboard-row leaderboard-row--me";
            const time = Number(source.best_time_ms);
            const timeText = Number.isFinite(time) ? `${(time / 1000).toFixed(2)}s` : "—";
            const rawName = localName || source.player_name || `Player ${source.player_id || "?"}`;
            const name = truncateLeaderboardName(rawName);
            row.dataset.playerId = source.player_id || "";
            const rankText = meRank ? String(meRank) : "—";
            row.innerHTML = `<span>${rankText}</span><span class="leaderboard-name" title="${rawName}">${name}</span><span>${timeText}</span>`;
            rows.push(row);
          } else {
            const row = document.createElement("div");
            row.className = "leaderboard-row leaderboard-row--me";
            row.dataset.playerId = window.getLeaderboardPlayerId ? window.getLeaderboardPlayerId() : "";
            const name = localName || "You";
            row.innerHTML = `<span>-</span><span class="leaderboard-name">${name}</span><span>-</span>`;
            rows.push(row);
          }
          if (rows.length) {
            listEl.replaceChildren(headerRow, ...rows);
          } else {
            const baseMessage = result && result.errorMessage ? result.errorMessage : "No data yet";
            loadingRow.textContent = baseMessage;
            listEl.replaceChildren(headerRow, loadingRow);
          }
          if (result && result.errorCode) {
            const statusRow = document.createElement("div");
            statusRow.className = "leaderboard-row leaderboard-row--empty";
            const budgetStatus =
              typeof window.getLeaderboardReadBudgetStatus === "function"
                ? window.getLeaderboardReadBudgetStatus()
                : null;
            if (result.errorCode === "read_budget_exceeded" && budgetStatus) {
              statusRow.textContent = `Leaderboard reads capped (${budgetStatus.totalReads}/${budgetStatus.limit}).`;
            } else {
              statusRow.textContent = result.errorMessage || "Leaderboard unavailable.";
            }
            listEl.appendChild(statusRow);
          }
        } catch (error) {
          console.warn("Failed to render leaderboard", error);
          loadingRow.textContent = "Leaderboard failed to load. Please try again later.";
          listEl.replaceChildren(headerRow, loadingRow);
        }
      };

      window.refreshVisibleLeaderboards = function refreshVisibleLeaderboards() {
        const stageList = document.getElementById("stageClearLeaderboardList");
        if (stageList && stageList.dataset.stageId) {
          const stage = window.getStageConfig
            ? window.getStageConfig(Number(stageList.dataset.stageId) - 1)
            : null;
          if (stage) {
            window.renderStageLeaderboard(stage, Number(stageList.dataset.stageId) - 1, "stageClearLeaderboardList", "stageClearLeaderboardEmpty");
          }
        }
        const modalList = document.getElementById("leaderboardModalList");
        if (modalList && leaderboardModal && leaderboardModal.classList.contains("show")) {
          const index = stageIntroPendingIndex;
          const stage = Number.isFinite(index) && window.getStageConfig ? window.getStageConfig(index) : null;
          if (stage) {
            window.renderStageLeaderboard(stage, index, "leaderboardModalList", "leaderboardModalEmpty");
          }
        }
      };

      window.updateVisibleLeaderboardName = function updateVisibleLeaderboardName(newName) {
        const playerId = window.getLeaderboardPlayerId ? window.getLeaderboardPlayerId() : "";
        if (!playerId || !newName) return;
        document.querySelectorAll(".leaderboard-row[data-player-id]").forEach((row) => {
          if (row.dataset.playerId === playerId) {
            const nameEl = row.querySelector(".leaderboard-name");
            if (nameEl) nameEl.textContent = newName;
          }
        });
      };
      if (stageIntroStart && stageIntroModal) {
        stageIntroStart.addEventListener("click", async () => {
          if (leaderboardModal) {
            setModalState(leaderboardModal, false);
          }
          const index = stageIntroPendingIndex;
          if (!Number.isFinite(index)) return;
          const stage = window.getStageConfig ? window.getStageConfig(index) : null;
          if (stage && String(stage.stageType).toLowerCase() === "flash") {
            if (flashWarningEnabled) {
              openFlashStagePrompt(index);
              return;
            }
            closeStageIntro();
            openSplashLoading("Loading…");
            const minimumDelay = new Promise((resolve) => {
              window.setTimeout(resolve, 750);
            });
            const fontsReady = document.fonts && document.fonts.ready
              ? document.fonts.ready
              : Promise.resolve();
            await Promise.all([minimumDelay, fontsReady]).catch(() => {});
            closeSplashLoading();
            startStage(index, { skipIntro: true, deferStartRound: true });
            startFlashRound();
            return;
          }
          closeStageIntro();
          openSplashLoading("Loading…");
          const minimumDelay = new Promise((resolve) => {
            window.setTimeout(resolve, 750);
          });
          const fontsReady = document.fonts && document.fonts.ready
            ? document.fonts.ready
            : Promise.resolve();
          await Promise.all([minimumDelay, fontsReady]).catch(() => {});
          closeSplashLoading();
          startStage(index, { skipIntro: true });
        });
      }
      if (stageIntroModal) {
        stageIntroModal.addEventListener("click", (event) => {
          if (event.target === stageIntroModal) {
            closeStageIntro();
          }
        });
      }
      if (flashStageStart) {
        flashStageStart.addEventListener("click", async () => {
          const index = flashStagePendingIndex;
          closeFlashStagePrompt();
          if (stageIntroModal && stageIntroModal.classList.contains("show")) {
            closeStageIntro();
          }
          if (Number.isFinite(index)) {
            openSplashLoading("Loading…");
            const minimumDelay = new Promise((resolve) => {
              window.setTimeout(resolve, 750);
            });
            const fontsReady = document.fonts && document.fonts.ready
              ? document.fonts.ready
              : Promise.resolve();
            await Promise.all([minimumDelay, fontsReady]).catch(() => {});
            closeSplashLoading();
            startStage(index, {
              skipIntro: true,
              deferStartRound: true,
              skipFlashWarningPrompt: true
            });
            startFlashRound();
          }
        });
      }
      function setFlashWarningEnabled(enabled, persist = true) {
        flashWarningEnabled = Boolean(enabled);
        if (flashStageSkip) {
          flashStageSkip.checked = !flashWarningEnabled;
        }
        if (photosensitivityWarningToggle) {
          photosensitivityWarningToggle.checked = flashWarningEnabled;
        }
        if (persist) {
          try {
            window.localStorage.setItem(FLASH_WARNING_KEY, flashWarningEnabled ? "1" : "0");
          } catch {
            // ignore storage errors
          }
        }
      }

      {
        const saved = window.localStorage.getItem(FLASH_WARNING_KEY);
        if (saved !== null) {
          setFlashWarningEnabled(saved === "1", false);
        } else {
          setFlashWarningEnabled(Boolean(defaultControlSettings.flashWarningEnabled), false);
        }
      }

      if (flashStageSkip) {
        flashStageSkip.addEventListener("change", () => {
          setFlashWarningEnabled(!flashStageSkip.checked, true);
        });
      }
      if (photosensitivityWarningToggle) {
        photosensitivityWarningToggle.addEventListener("change", () => {
          setFlashWarningEnabled(photosensitivityWarningToggle.checked, true);
        });
      }
      if (flashStageModal) {
        flashStageModal.addEventListener("click", (event) => {
          if (event.target === flashStageModal) {
            closeFlashStagePrompt();
          }
        });
      }
      if (fullscreenToggle) {
        fullscreenToggle.addEventListener("click", async () => {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          } else {
            await document.exitFullscreen();
          }
        });
      }

      if (playStart) {
        playStart.addEventListener("click", () => {
          openStagesScreen(true);
        });
      }

      if (mainMenuTitle) {
        mainMenuTitle.addEventListener("click", () => {
          splashReturnToHome = !shouldShowSplashScreen();
          openSplashScreen();
          attachSplashStartListeners();
        });
      }

      if (shouldShowSplashScreen()) {
        openSplashScreen();
        attachSplashStartListeners();
      } else {
        splashReturnToHome = true;
        openSplashScreen();
        attachSplashStartListeners();
      }

      if (stagesOpen) {
        stagesOpen.addEventListener("click", () => {
          openStagesScreen(true);
        });
      }

      if (stagesBack) {
        stagesBack.addEventListener("click", () => {
          closeStagesScreen();
        });
      }
      if (stagesPrev) {
        stagesPrev.addEventListener("click", () => {
          const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
          const pageSize = 20;
          const totalPages = Math.max(1, Math.ceil(stages.length / pageSize));
          stageState.page = (stageState.page - 1 + totalPages) % totalPages;
          renderStageList(false);
        });
      }
      if (stagesNext) {
        stagesNext.addEventListener("click", () => {
          const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
          const pageSize = 20;
          const totalPages = Math.max(1, Math.ceil(stages.length / pageSize));
          stageState.page = (stageState.page + 1) % totalPages;
          renderStageList(false);
        });
      }

      if (stageList) {
        stageList.addEventListener("click", (event) => {
          const button = event.target.closest(".stage-card");
          if (!button) return;
          const index = Number(button.dataset.stageIndex);
          if (!Number.isFinite(index)) return;
          
          // Check if stage is unlocked before starting
          if (!isStageUnlocked(index)) {
            return;
          }
          
          startStage(index, { originEl: button });
        });
      }

      if (inputGrid) {
        inputGrid.addEventListener("keydown", (event) => {
          if (event.key !== "Tab") return;
          if (tabTutorialActive) return;
          if (phase !== "recall") return;
          const inputs = Array.from(inputGrid.querySelectorAll('input[data-index]'));
          if (!inputs.length) return;
          const activeIndex = inputs.indexOf(document.activeElement);
          if (activeIndex === -1) return;
          event.preventDefault();
          const dir = event.shiftKey ? -1 : 1;
          const nextIndex = (activeIndex + dir + inputs.length) % inputs.length;
          inputs[nextIndex].focus();
        });
        inputGrid.addEventListener("input", (event) => {
          if (tabTutorialActive) return;
          if (gameMode !== "stages" || phase !== "recall") return;
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          if (!stage) return;
          if (tabTutorialStageIds.has(stage.id)) {
            if (tabTutorialShownRound === round) return;
            const input = event.target && event.target.closest('input[data-index="0"]');
            if (!input || !input.value) return;
            tabTutorialShownRound = round;
            tabTutorialActive = enterToNextEnabled ? false : true;
            if (!enterToNextEnabled) { 
              tabTutorialDisabledInputs = [];
              inputGrid.querySelectorAll('input[data-index]').forEach((field) => {
                const idx = Number(field.dataset.index);
                if (Number.isFinite(idx) && idx > 0 && !field.disabled) {
                  field.disabled = true;
                  tabTutorialDisabledInputs.push(field);
                }
              });
            }
            return;
          }
          const hintMessage = firstLetterHintStageMessages[stage.id];
          if (!hintMessage) return;
          const targetInput = event.target && event.target.closest('input[data-index]');
          if (!targetInput) return;
          const rawValue = targetInput.value ? String(targetInput.value) : "";
          const trimmed = rawValue.trim();
          if (trimmed.length <= 1) return;
          const firstCharMatch = trimmed.match(/[a-z0-9]/i);
          const firstChar = firstCharMatch ? firstCharMatch[0] : trimmed.charAt(0);
          targetInput.value = firstChar;
          targetInput.dispatchEvent(new Event("input", { bubbles: true }));
          const now = performance.now();
          if (now - firstLetterHintCooldown > 300) {
            firstLetterHintCooldown = now;
            showFirstLetterHint(hintMessage);
          }
        });
        inputGrid.addEventListener("pointerdown", (event) => {
          if (!tabTutorialActive) return;
          const targetInput = event.target.closest("input[data-index]");
          if (!targetInput) return;
          const idx = Number(targetInput.dataset.index);
          if (Number.isFinite(idx) && idx > 0) {
            event.preventDefault();
            const firstInput = inputGrid.querySelector('input[data-index="0"]');
            if (firstInput) firstInput.focus();
          }
        });
        inputGrid.addEventListener("focusin", (event) => {
          if (!tabTutorialActive) return;
          const targetInput = event.target.closest("input[data-index]");
          if (!targetInput) return;
          const idx = Number(targetInput.dataset.index);
          if (Number.isFinite(idx) && idx > 0) {
            const firstInput = inputGrid.querySelector('input[data-index="0"]');
            if (firstInput) firstInput.focus();
          }
        });
      }

      document.querySelectorAll("#practiceModal .checkboxes input").forEach((input) => {
        input.addEventListener("pointerdown", (event) => {
          dragSelecting = true;
          dragTargetState = !input.checked;
          input.checked = dragTargetState;
          event.preventDefault();
        });
        input.addEventListener("pointerenter", () => {
          if (!dragSelecting || dragTargetState === null) return;
          input.checked = dragTargetState;
        });
      });

      document.addEventListener("pointerup", () => {
        dragSelecting = false;
        dragTargetState = null;
      });

      practiceCancel.addEventListener("click", () => {
        closePracticeModal();
      });

      if (practiceDeselectAll) {
        practiceDeselectAll.addEventListener("click", () => {
          document
            .querySelectorAll("#practiceModal .control-group .checkboxes input[type=\"checkbox\"]")
            .forEach((input) => {
              input.checked = false;
            });
        });
      }
      if (practiceSelectAll) {
        practiceSelectAll.addEventListener("click", () => {
          document
            .querySelectorAll("#practiceModal .control-group .checkboxes input[type=\"checkbox\"]")
            .forEach((input) => {
              if (input.dataset.locked === "true") return;
              input.checked = true;
            });
        });
      }
      if (settingsOpen && settingsModal) {
        settingsOpen.addEventListener("click", () => {
          updatePlayerNameSettingVisibility();
          activeRebindAction = null;
          refreshKeybindButtons();
          setKeybindStatus("");
          setSettingsTab("general");
          setModalState(settingsModal, true);
        });
      }
      if (settingsClose && settingsModal) {
        settingsClose.addEventListener("click", () => {
          activeRebindAction = null;
          refreshKeybindButtons();
          setKeybindStatus("");
          setModalState(settingsModal, false);
        });
      }
      if (settingsModal) {
        settingsModal.querySelectorAll("[data-settings-tab]").forEach((button) => {
          button.addEventListener("click", () => {
            const tabName = button.getAttribute("data-settings-tab");
            if (!tabName) return;
            setSettingsTab(tabName);
          });
        });
        settingsModal.addEventListener("click", (event) => {
          if (event.target === settingsModal) {
            activeRebindAction = null;
            refreshKeybindButtons();
            setKeybindStatus("");
            setModalState(settingsModal, false);
          }
        });
      }
      if (playerNameModal) {
        playerNameModal.addEventListener("click", (event) => {
          if (event.target === playerNameModal) {
            markPlayerNamePrompted();
            closePlayerNameModal();
          }
        });
      }
      if (playerNameInput) {
        playerNameInput.addEventListener("input", () => {
          const normalized = normalizePlayerName(playerNameInput.value);
          if (playerNameSave) {
            playerNameSave.disabled = !normalized;
          }
        });
        playerNameInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && playerNameSave && !playerNameSave.disabled) {
            playerNameSave.click();
          }
        });
      }
      if (playerNameSave) {
        playerNameSave.addEventListener("click", () => {
          const normalized = setPlayerName(playerNameInput ? playerNameInput.value : "");
          if (!normalized) return;
          updatePlayerNameInputs(normalized);
          markPlayerNamePrompted();
          updatePlayerNameSettingVisibility();
          if (typeof window.updateVisibleLeaderboardName === "function") {
            window.updateVisibleLeaderboardName(normalized);
          }
          updateLeaderboardNameForExistingTimes(normalized).finally(() => {
            if (typeof window.refreshVisibleLeaderboards === "function") {
              window.setTimeout(() => window.refreshVisibleLeaderboards(), 800);
            }
          });
          closePlayerNameModal();
        });
      }
      if (playerNameSkip) {
        playerNameSkip.addEventListener("click", () => {
          markPlayerNamePrompted();
          updatePlayerNameSettingVisibility();
          closePlayerNameModal();
        });
      }
      if (playerNameSetting) {
        const name = getPlayerName();
        if (name) {
          playerNameSetting.value = name;
        }
        const applyPlayerNameFromSettings = () => {
          const normalized = setPlayerName(playerNameSetting.value);
          updatePlayerNameInputs(normalized);
          updatePlayerNameSettingVisibility();
          if (typeof window.updateVisibleLeaderboardName === "function") {
            window.updateVisibleLeaderboardName(normalized);
          }
          updateLeaderboardNameForExistingTimes(normalized).finally(() => {
            if (typeof window.refreshVisibleLeaderboards === "function") {
              window.setTimeout(() => window.refreshVisibleLeaderboards(), 800);
            }
          });
        };
        playerNameSetting.addEventListener("blur", () => {
          applyPlayerNameFromSettings();
        });
        playerNameSetting.addEventListener("change", () => {
          applyPlayerNameFromSettings();
        });
        playerNameSetting.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            playerNameSetting.blur();
          }
        });
      }
      const debugResetProgress = document.getElementById("debugResetProgress");
      const resetConfirmRow = document.getElementById("resetConfirmRow");
      const resetConfirmYes = document.getElementById("resetConfirmYes");
      const resetConfirmNo = document.getElementById("resetConfirmNo");
      const resetConfirmAnchor = resetConfirmRow ? resetConfirmRow.closest(".confirm-anchor") : null;
      const hideResetConfirmRow = () => {
        if (resetConfirmRow) {
          resetConfirmRow.setAttribute("hidden", "");
        }
      };
      if (debugResetProgress) {
        debugResetProgress.addEventListener("click", () => {
          if (!resetConfirmRow) return;
          if (resetConfirmRow.hasAttribute("hidden")) {
            resetConfirmRow.removeAttribute("hidden");
          } else {
            resetConfirmRow.setAttribute("hidden", "");
          }
        });
      }
      if (resetConfirmNo) {
        resetConfirmNo.addEventListener("click", () => {
          hideResetConfirmRow();
        });
        resetConfirmNo.addEventListener("keydown", (event) => {
          event.preventDefault();
        });
      }
      if (resetConfirmYes) {
        resetConfirmYes.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          document.body.classList.add("loading-overlay");
          if (splashLoading) {
            splashLoading.removeAttribute("aria-hidden");
          }
          resetConfirmYes.disabled = true;
          hideResetConfirmRow();
          document.body.classList.add("resetting");
          document.body.dataset.view = "loading";
          resetLoadingActive = true;
          if (settingsModal) {
            setModalState(settingsModal, false);
          }
          openSplashLoading("Resetting…");
          if (splashLoading) {
            const textEl = splashLoading.querySelector(".splash-loading__text");
            if (textEl) {
              textEl.textContent = "Resetting…";
            }
          }
          document.body.classList.remove("home-anim");
          await new Promise((resolve) => window.requestAnimationFrame(resolve));
          const fallbackTimer = window.setTimeout(() => {
            showSplashAfterLoading();
          }, 3000);
          try {
            const bestTimesSnapshot = window.stageBestTimes ? { ...window.stageBestTimes } : {};
          window.stageStars = {};
          window.stageBestTimes = {};
          window.stageCompleted = {};
          window.stageNewSeen = {};
          window.flashRecallSessionStats = {
            totalSeconds: 0,
            totalCards: 0,
            totalLevelAttempts: 0,
            totalLevelSuccesses: 0
          };
          window.localStorage.removeItem("flashRecallStats");
          window.localStorage.removeItem(FLASH_WARNING_KEY);
          window.localStorage.removeItem("flashRecallSandboxUnlocks");
          window.localStorage.removeItem("flashRecallPlayerName");
          window.localStorage.removeItem("flashRecallPlayerNamePrompted");
          window.localStorage.removeItem(APPEARANCE_THEME_KEY);
          window.localStorage.removeItem(APPEARANCE_FONT_KEY);
          window.localStorage.removeItem(APPEARANCE_LAYOUT_KEY);
          window.localStorage.removeItem(KEYBINDS_STORAGE_KEY);
          const resetTheme = appearanceOptions.themes.includes(defaultAppearance.theme)
            ? defaultAppearance.theme
            : appearanceOptions.themes[0];
          const resetFont = appearanceOptions.fonts.includes(defaultAppearance.font)
            ? defaultAppearance.font
            : appearanceOptions.fonts[0];
          const resetLayout = appearanceOptions.layouts.includes(defaultAppearance.layout)
            ? defaultAppearance.layout
            : appearanceOptions.layouts[0];
          applyAppearance(
            resetTheme,
            resetFont,
            resetLayout
          );
          keybinds = { ...defaultKeybinds };
          activeRebindAction = null;
          refreshKeybindButtons();
          refreshActionKeyHints();
          window.localStorage.removeItem(SPLASH_SEEN_KEY);
          if (playerNameSetting) {
            playerNameSetting.value = "";
          }
          updatePlayerNameSettingVisibility();
          if (typeof window.saveStageProgress === "function") {
            window.saveStageProgress();
          }
          if (typeof window.deactivateLocalLeaderboardEntries === "function") {
            window.deactivateLocalLeaderboardEntries(bestTimesSnapshot).catch(() => {});
          }
          if (typeof window.rotateLeaderboardPlayerId === "function") {
            window.rotateLeaderboardPlayerId();
            window.setTimeout(() => {
              window.location.reload();
            }, 50);
            return;
          }
          if (typeof window.getSandboxUnlockState === "function") {
            window.getSandboxUnlockState();
          }
          if (stagesScreen && document.body.dataset.view === "stages") {
            renderStageList(false);
          }
          if (practiceModal && practiceModal.classList.contains("show")) {
            updateCategoryControls();
            const starsEl = document.getElementById("sandboxStars");
            if (starsEl && typeof window.getSandboxStarsAvailable === "function") {
              const availableEl = starsEl.querySelector(".sandbox-stars__available");
              const available = window.getSandboxStarsAvailable();
              if (availableEl) {
                availableEl.textContent = String(available);
              }
            }
          }
          await new Promise((resolve) => {
            window.setTimeout(resolve, 750);
          });
          showSplashAfterLoading();
          resetLoadingActive = false;
          } finally {
            window.clearTimeout(fallbackTimer);
          }
        });
        resetConfirmYes.addEventListener("keydown", (event) => {
          event.preventDefault();
        });
      }
      if (settingsModal) {
        settingsModal.addEventListener("click", (event) => {
          if (event.target === settingsModal) {
            hideResetConfirmRow();
          }
        });
      }
      if (settingsClose) {
        settingsClose.addEventListener("click", () => {
          hideResetConfirmRow();
          if (playerNameSetting) {
            const normalized = setPlayerName(playerNameSetting.value);
            updatePlayerNameInputs(normalized);
            updatePlayerNameSettingVisibility();
            if (typeof window.updateVisibleLeaderboardName === "function") {
              window.updateVisibleLeaderboardName(normalized);
            }
            updateLeaderboardNameForExistingTimes(normalized).finally(() => {
              if (typeof window.refreshVisibleLeaderboards === "function") {
                window.setTimeout(() => window.refreshVisibleLeaderboards(), 800);
              }
            });
          }
        });
      }
      document.addEventListener("click", (event) => {
        if (!resetConfirmRow || resetConfirmRow.hasAttribute("hidden")) return;
        if (resetConfirmAnchor && resetConfirmAnchor.contains(event.target)) return;
        hideResetConfirmRow();
      });
      async function renderStatsMetricLeaderboard(metric, listId, emptyId, valueLabel) {
        const listEl = document.getElementById(listId);
        const emptyEl = document.getElementById(emptyId);
        if (!listEl) return;
        const getLocalProgress = () => {
          const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
          const stagesCleared = stages.reduce((sum, stage, index) => {
            const stageKey = window.getStageStarsKey
              ? window.getStageStarsKey(stage, index)
              : (stage && stage.id ? String(stage.id) : String(index + 1));
            return sum + (window.stageCompleted && window.stageCompleted[stageKey] ? 1 : 0);
          }, 0);
          const starsEarned = stages.reduce((sum, stage, index) => {
            const stageKey = window.getStageStarsKey
              ? window.getStageStarsKey(stage, index)
              : (stage && stage.id ? String(stage.id) : String(index + 1));
            return sum + (window.stageStars && window.stageStars[stageKey] ? window.stageStars[stageKey] : 0);
          }, 0);
          return { stagesCleared, starsEarned };
        };
        const headerRow = document.createElement("div");
        headerRow.className = "leaderboard-row";
        headerRow.innerHTML = `<span>#</span><span>Player</span><span>${valueLabel}</span>`;
        const loadingRow = document.createElement("div");
        loadingRow.className = "leaderboard-row leaderboard-row--empty";
        loadingRow.textContent = "Loading...";
        listEl.replaceChildren(headerRow, loadingRow);

        if (typeof window.fetchProgressLeaderboard !== "function") {
          loadingRow.textContent = "Leaderboard unavailable.";
          listEl.replaceChildren(headerRow, loadingRow);
          return;
        }
        const localProgress = getLocalProgress();
        if (typeof window.updateProgressLeaderboardSnapshot === "function") {
          const name = typeof window.getPlayerName === "function" ? window.getPlayerName() : "";
          window.updateProgressLeaderboardSnapshot(localProgress.stagesCleared, localProgress.starsEarned, name);
        }
        const localValue = metric === "stages_cleared" ? localProgress.stagesCleared : localProgress.starsEarned;
        try {
          let result = null;
          let attempts = 0;
          do {
            result = await window.fetchProgressLeaderboard(metric, 5, { refreshIfStale: true });
            if (result && result.errorCode !== "not_ready") break;
            attempts += 1;
            if (attempts <= 5) {
              await new Promise((resolve) => window.setTimeout(resolve, 350));
            }
          } while (attempts <= 5);
          const top = result && Array.isArray(result.top) ? result.top : [];
          const me = result ? result.me : null;
          const meRank = result && Number.isFinite(result.meRank) ? result.meRank : null;
          const localName = typeof window.getPlayerName === "function" ? window.getPlayerName() : "";
          const rows = [];
          const mePlayerId = window.getLeaderboardPlayerId ? window.getLeaderboardPlayerId() : "";
          let meInTop = false;
          top.forEach((entry, idx) => {
            const row = document.createElement("div");
            row.className = "leaderboard-row leaderboard-row--data";
            const value = Number(entry[metric]) || 0;
            const isMe = entry.player_id && mePlayerId && entry.player_id === mePlayerId;
            if (isMe) row.classList.add("leaderboard-row--me-top");
            if (isMe) meInTop = true;
            const name = isMe && localName ? localName : (entry.player_name || `Player ${entry.player_id || "?"}`);
            row.dataset.playerId = entry.player_id || "";
            row.innerHTML = `<span>${idx + 1}</span><span class="leaderboard-name">${name}</span><span>${value}</span>`;
            rows.push(row);
          });
          if (me && !meInTop) {
            const meRow = document.createElement("div");
            meRow.className = "leaderboard-row leaderboard-row--me";
            meRow.dataset.playerId = me.player_id || "";
            const value = Number(me[metric]);
            const safeValue = Number.isFinite(value) ? value : localValue;
            const rankText = meRank ? String(meRank) : "—";
            const name = localName || me.player_name || `Player ${me.player_id || "?"}`;
            meRow.innerHTML = `<span>${rankText}</span><span class="leaderboard-name">${name}</span><span>${safeValue}</span>`;
            rows.push(meRow);
          } else if (!me) {
            const meRow = document.createElement("div");
            meRow.className = "leaderboard-row leaderboard-row--me";
            meRow.dataset.playerId = mePlayerId;
            const name = localName || "You";
            meRow.innerHTML = `<span>-</span><span class="leaderboard-name">${name}</span><span>${localValue}</span>`;
            rows.push(meRow);
          }
          listEl.replaceChildren(headerRow, ...rows);
          if (result && result.errorCode) {
            const statusRow = document.createElement("div");
            statusRow.className = "leaderboard-row leaderboard-row--empty";
            statusRow.textContent = result.errorMessage || "Leaderboard unavailable.";
            listEl.appendChild(statusRow);
          }
        } catch (error) {
          console.warn("Failed to render stats leaderboard", error);
          const detail =
            error && error.message ? String(error.message) : "";
          loadingRow.textContent = detail || (emptyEl ? emptyEl.textContent || "Leaderboard unavailable." : "Leaderboard unavailable.");
          listEl.replaceChildren(headerRow, loadingRow);
        }
      }
      const statsLeaderboardTabs = {
        stars_earned: { title: "Stars leaderboard", valueLabel: "Stars" },
        stages_cleared: { title: "Stages cleared leaderboard", valueLabel: "Stages" }
      };
      let activeStatsLeaderboardTab = "stars_earned";

      async function openStatsLeaderboard(metric = activeStatsLeaderboardTab) {
        if (!statsLeaderboardModal) return;
        const nextTab = statsLeaderboardTabs[metric] ? metric : "stars_earned";
        activeStatsLeaderboardTab = nextTab;
        if (statsLeaderboardTitle) {
          statsLeaderboardTitle.textContent = statsLeaderboardTabs[nextTab].title;
        }
        [statsLeaderboardTabStars, statsLeaderboardTabStages].forEach((button) => {
          if (!button) return;
          const isActive = button.getAttribute("data-stats-leaderboard-tab") === nextTab;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        setModalState(statsLeaderboardModal, true);
        await renderStatsMetricLeaderboard(
          nextTab,
          "statsLeaderboardModalList",
          "statsLeaderboardModalEmpty",
          statsLeaderboardTabs[nextTab].valueLabel
        );
      }
      if (statsOpen && statsModal) {
        statsOpen.addEventListener("click", async () => {
          const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
          const stagesClearedEl = document.getElementById("statsStagesCleared");
          const stagesTotalEl = document.getElementById("statsStagesTotal");
          const starsEarnedEl = document.getElementById("statsStarsEarned");
          const avgPerCardEl = document.getElementById("statsAvgPerCard");
          const avgBestPerCardEl = document.getElementById("statsAvgBestPerCard");
          const totalTimeSpentEl = document.getElementById("statsTotalTimeSpent");
          const levelAttemptsEl = document.getElementById("statsLevelAttempts");
          const levelSuccessRateEl = document.getElementById("statsLevelSuccessRate");
          if (stagesClearedEl || stagesTotalEl || starsEarnedEl) {
            const totalStages = stages.length;
            const stagesCleared = stages.reduce((sum, stage, index) => {
              const stageKey = window.getStageStarsKey
                ? window.getStageStarsKey(stage, index)
                : (stage && stage.id ? String(stage.id) : String(index + 1));
              return sum + (window.stageCompleted && window.stageCompleted[stageKey] ? 1 : 0);
            }, 0);
            const starsEarned = stages.reduce((sum, stage, index) => {
              const stageKey = window.getStageStarsKey
                ? window.getStageStarsKey(stage, index)
                : (stage && stage.id ? String(stage.id) : String(index + 1));
              return sum + (window.stageStars && window.stageStars[stageKey] ? window.stageStars[stageKey] : 0);
            }, 0);
            if (stagesClearedEl) stagesClearedEl.textContent = String(stagesCleared);
            if (stagesTotalEl) stagesTotalEl.textContent = String(totalStages);
            if (starsEarnedEl) starsEarnedEl.textContent = String(starsEarned);
            if (typeof window.updateProgressLeaderboardSnapshot === "function") {
              const name = typeof window.getPlayerName === "function" ? window.getPlayerName() : "";
              window.updateProgressLeaderboardSnapshot(stagesCleared, starsEarned, name);
            }
          }

          const key = "flashRecallStats";
          let avgText = "-";
          let trackedTotalSeconds = 0;
          let totalLevelAttempts = 0;
          let totalLevelSuccesses = 0;
          const formatDuration = (seconds) => {
            const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
            const hours = Math.floor(safeSeconds / 3600);
            const minutes = Math.floor((safeSeconds % 3600) / 60);
            const secs = safeSeconds % 60;
            if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
            if (minutes > 0) return `${minutes}m ${secs}s`;
            return `${secs}s`;
          };
          try {
            const rawStats = window.localStorage.getItem(key);
            if (rawStats) {
              const parsed = JSON.parse(rawStats);
              const totalSeconds = Number(parsed && parsed.totalSeconds) || 0;
              const totalCards = Number(parsed && parsed.totalCards) || 0;
              trackedTotalSeconds = totalSeconds;
              totalLevelAttempts = Number(parsed && parsed.totalLevelAttempts) || 0;
              totalLevelSuccesses = Number(parsed && parsed.totalLevelSuccesses) || 0;
              if (totalCards > 0) {
                const avg = totalSeconds / totalCards;
                avgText = `${avg.toFixed(2)}s`;
              }
            }
          } catch (error) {
            avgText = "-";
          }
          if (avgText === "-" || totalLevelAttempts <= 0 || trackedTotalSeconds <= 0) {
            const sessionStats = window.flashRecallSessionStats;
            const totalSeconds = Number(sessionStats && sessionStats.totalSeconds) || 0;
            const totalCards = Number(sessionStats && sessionStats.totalCards) || 0;
            if (avgText === "-" && totalCards > 0) {
              avgText = `${(totalSeconds / totalCards).toFixed(2)}s`;
            }
            if (trackedTotalSeconds <= 0 && totalSeconds > 0) {
              trackedTotalSeconds = totalSeconds;
            }
            if (totalLevelAttempts <= 0) {
              totalLevelAttempts = Number(sessionStats && sessionStats.totalLevelAttempts) || 0;
              totalLevelSuccesses = Number(sessionStats && sessionStats.totalLevelSuccesses) || 0;
            }
          }
          if (avgPerCardEl) {
            avgPerCardEl.textContent = avgText;
          }
          if (totalTimeSpentEl) {
            totalTimeSpentEl.textContent = trackedTotalSeconds > 0 ? formatDuration(trackedTotalSeconds) : "-";
          }
          if (levelAttemptsEl) {
            levelAttemptsEl.textContent = String(Math.max(0, totalLevelAttempts));
          }
          if (levelSuccessRateEl) {
            if (totalLevelAttempts > 0) {
              const clampedSuccesses = Math.max(0, Math.min(totalLevelAttempts, totalLevelSuccesses));
              const rate = (clampedSuccesses / totalLevelAttempts) * 100;
              levelSuccessRateEl.textContent = `${rate.toFixed(1)}%`;
            } else {
              levelSuccessRateEl.textContent = "-";
            }
          }

          if (avgBestPerCardEl) {
            const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
            const totals = stages.reduce(
              (acc, stage, index) => {
                const stageKey = stage && stage.id ? String(stage.id) : String(index + 1);
                const bestKey = window.getStageBestTimeKey
                  ? window.getStageBestTimeKey(stage, index)
                  : stageKey;
                const bestSeconds = Number(window.stageBestTimes && window.stageBestTimes[bestKey]);
                if (!Number.isFinite(bestSeconds)) return acc;
                const rounds = Number(stage.rounds) || 1;
                const cards = window.getStageCardCount ? window.getStageCardCount(stage) : stage.cards || 1;
                const totalCards = Math.max(1, rounds * (Number(cards) || 1));
                acc.seconds += bestSeconds;
                acc.cards += totalCards;
                return acc;
              },
              { seconds: 0, cards: 0 }
            );
            if (totals.cards > 0) {
              avgBestPerCardEl.textContent = `${(totals.seconds / totals.cards).toFixed(2)}s`;
            } else {
              avgBestPerCardEl.textContent = "�";
            }
          }
          setModalState(statsModal, true);
        });
      }
      if (statsLeaderboardOpen) {
        statsLeaderboardOpen.addEventListener("click", () => {
          openStatsLeaderboard(activeStatsLeaderboardTab);
        });
      }
      [statsLeaderboardTabStars, statsLeaderboardTabStages].forEach((button) => {
        if (!button) return;
        button.addEventListener("click", () => {
          const tab = button.getAttribute("data-stats-leaderboard-tab");
          if (!tab) return;
          openStatsLeaderboard(tab);
        });
      });
      if (statsLeaderboardModal) {
        statsLeaderboardModal.addEventListener("keydown", (event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          const order = ["stars_earned", "stages_cleared"];
          const idx = order.indexOf(activeStatsLeaderboardTab);
          const nextIdx = event.key === "ArrowRight"
            ? (idx + 1) % order.length
            : (idx - 1 + order.length) % order.length;
          event.preventDefault();
          openStatsLeaderboard(order[nextIdx]);
        });
      }
      if (statsClose && statsModal) {
        statsClose.addEventListener("click", () => {
          setModalState(statsModal, false);
        });
      }
      if (statsModal) {
        statsModal.addEventListener("click", (event) => {
          if (event.target === statsModal) {
            setModalState(statsModal, false);
          }
        });
      }
      if (statsLeaderboardClose && statsLeaderboardModal) {
        statsLeaderboardClose.addEventListener("click", () => {
          setModalState(statsLeaderboardModal, false);
        });
      }
      if (statsLeaderboardModal) {
        statsLeaderboardModal.addEventListener("click", (event) => {
          if (event.target === statsLeaderboardModal) {
            setModalState(statsLeaderboardModal, false);
          }
        });
      }

      practiceConfirm.addEventListener("click", () => {
        const selectedTypes = Array.from(
          practiceModal.querySelectorAll(".control-group .checkboxes input[type=\"checkbox\"][value]")
        ).filter((input) => input.checked);
        if (!selectedTypes.length) {
          const error = document.getElementById("practiceTypeError");
          if (error) {
            error.hidden = false;
            error.classList.remove("show");
            void error.offsetWidth;
            error.classList.add("show");
            if (error.dataset.hideTimer) {
              clearTimeout(Number(error.dataset.hideTimer));
            }
            const timerId = window.setTimeout(() => {
              hidePracticeError(error);
            }, 3000);
            error.dataset.hideTimer = String(timerId);
          }
          return;
        }
        const error = document.getElementById("practiceTypeError");
        if (error) {
          hidePracticeError(error);
        }
        modeSelect.value = "practice";
        updateModeUI();
        resetGame();
        closePracticeModal();
        startRound();
      });

      practiceModal.addEventListener("click", (event) => {
        if (event.target === practiceModal) {
          closePracticeModal();
        }
      });

      function hidePracticeError(error, resetText = "") {
        if (!error) return;
        error.classList.remove("show");
        if (error.dataset.hideTimer) {
          clearTimeout(Number(error.dataset.hideTimer));
        }
        const fadeId = window.setTimeout(() => {
          error.hidden = true;
          if (resetText) {
            error.textContent = resetText;
          }
          error.dataset.hideTimer = "";
        }, 260);
        error.dataset.hideTimer = String(fadeId);
      }

      if (practiceModal) {
        practiceModal.addEventListener("change", (event) => {
          const target = event.target;
          if (!(target && target.matches("input[type=\"checkbox\"]"))) return;
          const error = document.getElementById("practiceTypeError");
          const unlockType = target.dataset.unlockType;
          const cost = Number(target.dataset.cost || 0);
          const isLocked = target.dataset.locked === "true";
          if (target.checked && isLocked && unlockType) {
            const unlockKey = unlockType === "modifiers" ? target.id : target.value;
            const unlocked =
              typeof window.unlockSandboxItem === "function"
                ? window.unlockSandboxItem(unlockType, unlockKey)
                : false;
            if (!unlocked) {
              target.checked = false;
              if (error) {
                error.textContent = `Need ${cost} stars to unlock.`;
                error.hidden = false;
                error.classList.remove("show");
                void error.offsetWidth;
                error.classList.add("show");
                if (error.dataset.hideTimer) {
                  clearTimeout(Number(error.dataset.hideTimer));
                }
                const timerId = window.setTimeout(() => {
                  hidePracticeError(error, "Select at least one card type to start Sandbox.");
                }, 2000);
                error.dataset.hideTimer = String(timerId);
              }
              return;
            }
            updateCategoryControls();
            const starsEl = document.getElementById("sandboxStars");
            if (starsEl && typeof window.getSandboxStarsAvailable === "function") {
              const availableEl = starsEl.querySelector(".sandbox-stars__available");
              const available = window.getSandboxStarsAvailable();
              if (availableEl) {
                availableEl.textContent = String(available);
              } else {
                starsEl.textContent = `✦ ${available}`;
              }
            }
          }
          if (!error) return;
          const anyChecked = Array.from(
            practiceModal.querySelectorAll(".control-group .checkboxes input[type=\"checkbox\"][value]")
          ).some((input) => input.checked);
          if (anyChecked) {
            hidePracticeError(error);
          }
        });
      }

      interruptClose.addEventListener("click", () => {
        hideAd();
        if (pendingSkipAfterAd) {
          pendingSkipAfterAd = false;
          beginRecallPhase();
        }
      });

      window.addEventListener("mousemove", (event) => {
        if (!fogActive) return;
        const now = performance.now();
        const x = event.clientX;
        const y = event.clientY;
        if (fogLastMove.x !== null) {
          const dx = x - fogLastMove.x;
          const dy = y - fogLastMove.y;
          const dt = Math.max(1, now - fogLastMove.t);
          const speed = Math.hypot(dx, dy) / dt;
          if (speed >= 0.25) {
            clearFogAt(x, y, speed, fogLastMove.x, fogLastMove.y);
          }
        }
        fogLastMove = { x, y, t: now };
      });

      window.addEventListener("mousemove", (event) => {
        if (!blurActive) return;
        const now = performance.now();
        const x = event.clientX;
        const y = event.clientY;
        if (blurLastMove.x !== null) {
          const dx = x - blurLastMove.x;
          const dy = y - blurLastMove.y;
          const dt = Math.max(1, now - blurLastMove.t);
          const speed = Math.hypot(dx, dy) / dt;
          if (speed >= 0.25) {
            clearBlurAt(x, y, speed, blurLastMove.x, blurLastMove.y);
          }
        }
        blurLastMove = { x, y, t: now };
      });

      window.addEventListener("resize", () => {
        if (!fogActive) return;
        resizeFog();
        drawFog();
      });

      window.addEventListener("resize", () => {
        if (!blurActive) return;
        resizeBlur();
        drawBlur();
      });

      window.addEventListener("keydown", (event) => {
        if (!isPlatformerControlActive()) return;
        const key = event.key.toLowerCase();
        if (event.key.startsWith("Arrow") || key === "a" || key === "d" || key === "w" || key === " ") {
          event.preventDefault();
        }
        if (event.key === "ArrowLeft" || key === "a") {
          platformerState.keys.left = true;
        }
        if (event.key === "ArrowRight" || key === "d") {
          platformerState.keys.right = true;
        }
        if (event.key === "ArrowUp" || event.key === " " || key === "w") {
          platformerState.keys.jump = true;
        }
      });

      window.addEventListener("keyup", (event) => {
        if (!platformerState.enabled) return;
        const key = event.key.toLowerCase();
        if (event.key === "ArrowLeft" || key === "a") {
          platformerState.keys.left = false;
        }
        if (event.key === "ArrowRight" || key === "d") {
          platformerState.keys.right = false;
        }
      });

      platformerLoop();
      
      document.addEventListener("keydown", (event) => {
        // Only allow arrow key input during recall phase in game view
        if (phase !== "recall") return;
        // Get the focused input field
        const activeInput = document.querySelector('input[type="text"]:focus');
        if (!activeInput) return;
        
        // Map arrow keys to arrow characters - clear and replace
        switch(event.key) {
          case "ArrowUp":
            event.preventDefault();
            if (activeInput) {
              const nextArrow = "↑";
              const current = String(activeInput.value || "").trim();
              const isArrowSeq = /^[↑↓←→]+$/.test(current);
              if (isArrowSeq && current.length === 1) {
                activeInput.value = current + nextArrow;
              } else {
                activeInput.value = nextArrow;
              }
              activeInput.dispatchEvent(new Event("input", { bubbles: true }));
            }
            break;
          case "ArrowDown":
            event.preventDefault();
            if (activeInput) {
              const nextArrow = "↓";
              const current = String(activeInput.value || "").trim();
              const isArrowSeq = /^[↑↓←→]+$/.test(current);
              if (isArrowSeq && current.length === 1) {
                activeInput.value = current + nextArrow;
              } else {
                activeInput.value = nextArrow;
              }
              activeInput.dispatchEvent(new Event("input", { bubbles: true }));
            }
            break;
          case "ArrowLeft":
            event.preventDefault();
            if (activeInput) {
              const nextArrow = "←";
              const current = String(activeInput.value || "").trim();
              const isArrowSeq = /^[↑↓←→]+$/.test(current);
              if (isArrowSeq && current.length === 1) {
                activeInput.value = current + nextArrow;
              } else {
                activeInput.value = nextArrow;
              }
              activeInput.dispatchEvent(new Event("input", { bubbles: true }));
            }
            break;
          case "ArrowRight":
            event.preventDefault();
            if (activeInput) {
              const nextArrow = "→";
              const current = String(activeInput.value || "").trim();
              const isArrowSeq = /^[↑↓←→]+$/.test(current);
              if (isArrowSeq && current.length === 1) {
                activeInput.value = current + nextArrow;
              } else {
                activeInput.value = nextArrow;
              }
              activeInput.dispatchEvent(new Event("input", { bubbles: true }));
            }
            break;
        }
      });

      // Pause UI removed.

      if (submitBtn) {
        submitBtn.addEventListener("click", () => {
          checkAnswers();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          if (phase === "result" && gameMode === "stages") {
            if (stageState.completed) {
              resetStageProgress();
              resetGame();
              openStagesScreen(false);
              return;
            }
            if (stageState.failed) {
              stageState.failed = false;
              stageState.completed = false;
              stageState.startTime = performance.now();
              stageState.active = false;
              resetGame();
              startRound({ advanceRound: true });
              return;
            }
          }
          startRound();
        });
      }

      function handleResultActionClick(event) {
        const menuButton = event.target.closest("#stageMenuButton, #stageBackButton");
        if (menuButton) {
          // Analytics: Track level quit via back button
          if (gameMode === "stages" && stageState.active && !stageState.completed) {
            const backElapsedSeconds = Number.isFinite(stageState.elapsedSeconds)
              ? stageState.elapsedSeconds
              : (performance.now() - (stageState.startTime || performance.now())) / 1000;
            const backEntries = window.__lastEntries || [];
            const activeContext = typeof window.getActiveLevelContext === "function"
              ? window.getActiveLevelContext()
              : null;
            if (typeof trackQuitReason === "function") {
              trackQuitReason("menu_quit", activeContext || {});
            }
            if (typeof window.recordLevelAttemptStats === "function") {
              window.recordLevelAttemptStats(false);
            }
            if (typeof trackLevelSession === 'function') {
              trackLevelSession(stageState.index, false, 0, backElapsedSeconds, backEntries, "menu_quit", activeContext || {});
            }
          }
          resetStageProgress();
          resetGame();
          openStagesScreen(false);
          return;
        }
        const nextButton = event.target.closest("#stageNextButton");
        if (nextButton) {
          const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
          const nextIndex = stageState.index + 1;
          if (!stages[nextIndex]) return;
          startStage(nextIndex, { skipIntro: false });
          return;
        }
        const practiceBack = event.target.closest("#practiceBackButton");
        if (practiceBack) {
          resetGame();
          setPhase("Waiting to start", "idle");
          document.body.dataset.view = "home";
          document.body.classList.remove("home-anim");
          void document.body.offsetWidth;
          document.body.classList.add("home-anim");
          return;
        }
        const practiceRetry = event.target.closest("#practiceRetryButton");
        if (practiceRetry) {
          resetForRetryRound();
          startRound({ reuseItems: false, advanceRound: false });
          return;
        }
        const practiceSettings = event.target.closest("#practiceSettingsButton");
        if (practiceSettings) {
          openPracticeModal();
          return;
        }
        const homeButton = event.target.closest("#stageHomeButton");
        if (homeButton) {
          resetStageProgress();
          resetGame();
          setPhase("Waiting to start", "idle");
          modeSelect.value = "practice";
          updateModeUI();
          document.body.dataset.view = "home";
          document.body.classList.remove("home-anim");
          void document.body.offsetWidth;
          document.body.classList.add("home-anim");
          updatePracticeLock();
          return;
        }
        const retryButton = event.target.closest("#stageRetryButton");
        if (!retryButton) return;
        startStage(stageState.index, { skipIntro: true });
        return;
      }

      if (resultsPanel) {
        resultsPanel.addEventListener("click", handleResultActionClick);
      }
      if (actions) {
        actions.addEventListener("click", handleResultActionClick);
      }

      modeSelect.addEventListener("change", () => {
        if (modeSelect.value !== "stages") {
          resetStageProgress();
        }
        updateModeUI();
        resetGame();
      });

      document.addEventListener("keydown", (event) => {
        if (activeRebindAction) {
          const key = normalizeKey(event.key);
          if (!key) {
            event.preventDefault();
            return;
          }
          if (key === "escape") {
            event.preventDefault();
            activeRebindAction = null;
            setKeybindStatus("Keybind update cancelled.");
            refreshKeybindButtons();
            return;
          }
          if (!isBindableKey(key)) {
            event.preventDefault();
            setKeybindStatus("Use letters, numbers, arrows, Enter, or Space.");
            return;
          }
          const conflict = Object.keys(keybinds).find(
            (action) => action !== activeRebindAction && normalizeKey(keybinds[action]) === key
          );
          const isRetryNextPair =
            (activeRebindAction === "retry" && conflict === "stageNext") ||
            (activeRebindAction === "stageNext" && conflict === "retry");
          if (conflict && !isRetryNextPair) {
            event.preventDefault();
            setKeybindStatus(`"${getKeyLabel(key)}" is already used. Choose another key.`);
            return;
          }
          keybinds[activeRebindAction] = key;
          event.preventDefault();
          activeRebindAction = null;
          saveKeybinds();
          refreshKeybindButtons();
          refreshActionKeyHints();
          setKeybindStatus("Keybind saved.");
          return;
        }
        if (playerNamePromptDelayActive && phase === "result" && gameMode === "stages") {
          event.preventDefault();
          return;
        }
        if (playerNameModal && playerNameModal.classList.contains("show")) {
          if (event.key === "Escape") {
            event.preventDefault();
            markPlayerNamePrompted();
            closePlayerNameModal();
            return;
          }
          if (event.key === "Enter" && playerNameSave && !playerNameSave.disabled) {
            event.preventDefault();
            playerNameSave.click();
            return;
          }
          return;
        }
        if (tabTutorialActive) {
          if (event.key === "Tab") {
            tabTutorialActive = false;
            if (tabTutorialDisabledInputs.length) {
              tabTutorialDisabledInputs.forEach((field) => {
                field.disabled = false;
              });
              tabTutorialDisabledInputs = [];
            }
            return;
          }
        }
        if (referenceModal && referenceModal.classList.contains("show")) {
          if (event.key === "Escape") {
            event.preventDefault();
            setModalState(referenceModal, false);
          }
          return;
        }
        if (flashStageModal && flashStageModal.classList.contains("show")) {
          if (event.key === "Escape") {
            event.preventDefault();
            closeFlashStagePrompt();
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (flashStageStart) {
              flashStageStart.click();
            }
            return;
          }
          return;
        }
        if (stageIntroModal && stageIntroModal.classList.contains("show")) {
          if (event.key === "Escape") {
            event.preventDefault();
            closeStageIntro();
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            clearTabKeyHint();
            if (stageIntroStart) {
              stageIntroStart.click();
            }
            return;
          }
          return;
        }
        if (leaderboardModal && leaderboardModal.classList.contains("show")) {
          if (event.key === "Escape") {
            event.preventDefault();
            setModalState(leaderboardModal, false);
          }
          if (event.key === "Enter") {
            event.preventDefault();
          }
          return;
        }
        if (document.body.dataset.view === "stages") {
          if (event.key === "Escape") {
            event.preventDefault();
            closeStagesScreen();
          }
          return;
        }
        if (practiceModal.classList.contains("show")) {
          if (event.key === "Enter") {
            event.preventDefault();
            practiceConfirm.click();
          } else if (event.key === "Escape") {
            event.preventDefault();
            closePracticeModal();
          }
          return;
        }
        if (event.key === "Escape") {
          if (gameMode === "stages" && (stageState.active || phase === "result")) {
            event.preventDefault();
            if (stageState.active && !stageState.completed) {
              const backElapsedSeconds = Number.isFinite(stageState.elapsedSeconds)
                ? stageState.elapsedSeconds
                : (performance.now() - (stageState.startTime || performance.now())) / 1000;
              const backEntries = window.__lastEntries || [];
              const activeContext = typeof window.getActiveLevelContext === "function"
                ? window.getActiveLevelContext()
                : null;
              if (typeof trackQuitReason === "function") {
                trackQuitReason("menu_quit", activeContext || {});
              }
              if (typeof window.recordLevelAttemptStats === "function") {
                window.recordLevelAttemptStats(false);
              }
              if (typeof trackLevelSession === 'function') {
                trackLevelSession(stageState.index, false, 0, backElapsedSeconds, backEntries, "menu_quit", activeContext || {});
              }
            }
            resetStageProgress();
            resetGame();
            openStagesScreen(false);
          }
          return;
        }
        if (phase === "result" && gameMode === "stages") {
          if (keybindMatches(event, "stageQuit")) {
            event.preventDefault();
            const menuBtn =
              document.getElementById("stageMenuButton") || document.getElementById("stageBackButton");
            if (menuBtn) menuBtn.click();
            return;
          }
          if (keybindMatches(event, "stageNext")) {
            const nextBtn = document.getElementById("stageNextButton");
            if (nextBtn) {
              event.preventDefault();
              nextBtn.click();
              return;
            }
          }
          if (keybindMatches(event, "retry")) {
            event.preventDefault();
            const retryBtn = document.getElementById("stageRetryButton");
            if (retryBtn) retryBtn.click();
            return;
          }
          if (event.key === "Enter" && document.body.classList.contains("stage-fail")) {
            event.preventDefault();
            const retryBtn = document.getElementById("stageRetryButton");
            if (retryBtn) retryBtn.click();
            return;
          }
          
        }
        if (phase === "result" && gameMode === "practice") {
          if (keybindMatches(event, "practiceHome")) {
            event.preventDefault();
            const backBtn = document.getElementById("practiceBackButton");
            if (backBtn) backBtn.click();
            return;
          }
          if (keybindMatches(event, "retry")) {
            event.preventDefault();
            const retryBtn = document.getElementById("practiceRetryButton");
            if (retryBtn) retryBtn.click();
            return;
          }
          if (event.key === "Enter" && document.body.classList.contains("stage-fail")) {
            event.preventDefault();
            const retryBtn = document.getElementById("practiceRetryButton");
            if (retryBtn) retryBtn.click();
            return;
          }
          
          if (keybindMatches(event, "practiceSettings")) {
            event.preventDefault();
            const settingsBtn = document.getElementById("practiceSettingsButton");
            if (settingsBtn) settingsBtn.click();
            return;
          }
        }
        if (successAnimationActive) {
          event.preventDefault();
          return;
        }
        if (event.key !== "Enter") return;
        if (phase === "recall" && (swapTimeoutId || swapStartRecall)) {
          event.preventDefault();
          return;
        }
        if (phase === "show") {
          skipRevealNow();
        } else if (phase === "recall") {
          const inputs = Array.from(inputGrid.querySelectorAll('input[data-index]'));
          const activeIndex = inputs.indexOf(document.activeElement);
          if (activeIndex !== -1 && activeIndex < inputs.length - 1) {
            event.preventDefault();
            inputs[activeIndex + 1].focus();
            return;
          }
          checkAnswers();
        }
      });

      function showTabKeyHint() {
        const hud = document.getElementById("hudCluster");
        if (!hud) return;
        const rect = hud.getBoundingClientRect();
        let left = rect.left + rect.width / 2;
        let top = rect.bottom + 170;
        if (!Number.isFinite(left) || rect.width === 0) {
          left = window.innerWidth / 2;
          top = 120;
        }
        if (!tabTutorialHintEl) {
          tabTutorialHintEl = document.createElement("div");
          tabTutorialHintEl.className = "tab-key-hint";
          tabTutorialHintEl.innerHTML = `<span class="tab-keycap">TAB</span>`;
          document.body.appendChild(tabTutorialHintEl);
        }
        tabTutorialHintEl.style.left = `${left}px`;
        tabTutorialHintEl.style.top = `${top}px`;
        tabTutorialHintEl.style.animation = "none";
        void tabTutorialHintEl.offsetWidth;
        tabTutorialHintEl.style.animation = "";
        if (tabTutorialHintTimeout) {
          clearTimeout(tabTutorialHintTimeout);
        }
        tabTutorialHintTimeout = window.setTimeout(() => {
          if (tabTutorialHintEl) {
            tabTutorialHintEl.remove();
            tabTutorialHintEl = null;
          }
          tabTutorialHintTimeout = null;
        }, 1200);
      }

      function showFirstLetterHint(message) {
        const hud = document.getElementById("hudCluster");
        const rect = hud ? hud.getBoundingClientRect() : null;
        let left = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        let top = rect ? rect.bottom + 170 : 140;
        if (!Number.isFinite(left)) left = window.innerWidth / 2;
        if (!Number.isFinite(top)) top = 140;
        if (!firstLetterHintEl) {
          firstLetterHintEl = document.createElement("div");
          firstLetterHintEl.className = "first-letter-hint";
          firstLetterHintEl.innerHTML = `<span class="first-letter-pill"></span>`;
          document.body.appendChild(firstLetterHintEl);
        }
        const pill = firstLetterHintEl.querySelector(".first-letter-pill");
        if (pill) {
          pill.textContent = message;
          pill.style.whiteSpace = "pre-line";
          pill.style.textAlign = "center";
        }
        firstLetterHintEl.style.left = `${left}px`;
        firstLetterHintEl.style.top = `${top}px`;
        firstLetterHintEl.style.animation = "none";
        void firstLetterHintEl.offsetWidth;
        firstLetterHintEl.style.animation = "";
        if (firstLetterHintTimeout) {
          clearTimeout(firstLetterHintTimeout);
        }
        firstLetterHintTimeout = window.setTimeout(() => {
          if (firstLetterHintEl) {
            firstLetterHintEl.remove();
            firstLetterHintEl = null;
          }
          firstLetterHintTimeout = null;
        }, 2600);
      }

      function clearFirstLetterHint() {
        if (firstLetterHintTimeout) {
          clearTimeout(firstLetterHintTimeout);
          firstLetterHintTimeout = null;
        }
        if (firstLetterHintEl) {
          firstLetterHintEl.remove();
          firstLetterHintEl = null;
        }
      }
      window.clearFirstLetterHint = clearFirstLetterHint;


      document.addEventListener("pointerdown", (event) => {
        if (!tabTutorialActive) return;
        showTabKeyHint();
      }, { capture: true });

      loadKeybinds();
      refreshKeybindButtons();
      refreshActionKeyHints();
      if (keybindResetDefaults) {
        keybindResetDefaults.addEventListener("click", () => {
          keybinds = { ...defaultKeybinds };
          activeRebindAction = null;
          saveKeybinds();
          refreshKeybindButtons();
          refreshActionKeyHints();
          setKeybindStatus("Keybinds reset.");
        });
      }
      Object.entries(keybindButtons).forEach(([action, button]) => {
        if (!button) return;
        button.addEventListener("click", () => {
          activeRebindAction = activeRebindAction === action ? null : action;
          setKeybindStatus(
            activeRebindAction
              ? `Press a key for ${button.parentElement ? button.parentElement.firstElementChild.textContent.toLowerCase() : "selected action"}.`
              : ""
          );
          refreshKeybindButtons();
        });
      });

      {
        const storedAppearance = getStoredAppearance();
        applyAppearance(storedAppearance.theme, storedAppearance.font, storedAppearance.layout);
      }
      {
        const storedAudio = getStoredAudioSettings();
        applyAudioSettings(storedAudio, false);
      }

      if (audioMasterVolume && audioMusicVolume && audioEffectsVolume) {
        const syncAudioSettings = () => {
          applyAudioSettings(
            {
              master: audioMasterVolume.value,
              music: audioMusicVolume.value,
              effects: audioEffectsVolume.value
            },
            true
          );
        };
        audioMasterVolume.addEventListener("input", syncAudioSettings);
        audioMusicVolume.addEventListener("input", syncAudioSettings);
        audioEffectsVolume.addEventListener("input", syncAudioSettings);
      }

      updateModeUI();
      updatePracticeLock();
      resetGame();
      updateCategoryControls();

      if (successAnimationToggle) {
        const storageKey = "flashRecallSuccessAnimation";
        const saved = window.localStorage.getItem(storageKey);
        if (saved !== null) {
          successAnimationToggle.checked = saved === "1";
        } else {
          successAnimationToggle.checked = Boolean(defaultControlSettings.successAnimation);
        }
        setSuccessAnimationEnabled(successAnimationToggle.checked);
        successAnimationToggle.addEventListener("change", () => {
          window.localStorage.setItem(storageKey, successAnimationToggle.checked ? "1" : "0");
          setSuccessAnimationEnabled(successAnimationToggle.checked);
        });
      }
      enterToNextEnabled = true;


      if (flashCountdownToggle) {
        const storageKey = "flashRecallFlashCountdown";
        const saved = window.localStorage.getItem(storageKey);
        if (saved !== null) {
          flashCountdownToggle.checked = saved === "1";
        } else {
          flashCountdownToggle.checked = Boolean(defaultControlSettings.flashCountdown);
        }
        flashCountdownEnabled = flashCountdownToggle.checked;
        flashCountdownToggle.addEventListener("change", () => {
          flashCountdownEnabled = flashCountdownToggle.checked;
          window.localStorage.setItem(storageKey, flashCountdownToggle.checked ? "1" : "0");
        });
      }

      if (appearanceTheme && appearanceFont) {
        const persistAndApplyAppearance = () => {
          const theme = appearanceTheme.value;
          const font = appearanceFont.value;
          applyAppearance(theme, font, "classic");
          window.localStorage.setItem(APPEARANCE_THEME_KEY, document.body.dataset.theme || appearanceOptions.themes[0]);
          window.localStorage.setItem(APPEARANCE_FONT_KEY, document.body.dataset.font || appearanceOptions.fonts[0]);
          window.localStorage.setItem(APPEARANCE_LAYOUT_KEY, "classic");
        };
        appearanceTheme.addEventListener("change", persistAndApplyAppearance);
        appearanceFont.addEventListener("change", persistAndApplyAppearance);

      }

      if (appearanceShuffle && appearanceTheme && appearanceFont) {
        appearanceShuffle.addEventListener("click", () => {
          const pick = (list) => list[Math.floor(Math.random() * list.length)];
          appearanceTheme.value = pick(appearanceOptions.themes);
          appearanceFont.value = pick(appearanceOptions.fonts);
          appearanceTheme.dispatchEvent(new Event("change"));
        });
      }

      // Track session end on page unload
      window.addEventListener("beforeunload", () => {
        const activeContext = typeof window.getActiveLevelContext === "function"
          ? window.getActiveLevelContext()
          : null;
        if (activeContext && typeof trackQuitReason === "function") {
          trackQuitReason("close_tab_mid_level", activeContext);
        }
        const totalSessionSeconds = (performance.now() - sessionStartTime) / 1000;
        if (typeof trackSessionEnd === 'function') {
          trackSessionEnd(totalSessionSeconds, lastCompletedLevel, "beforeunload");
        }
      });
      function clearTabKeyHint() {
        if (tabTutorialHintTimeout) {
          clearTimeout(tabTutorialHintTimeout);
          tabTutorialHintTimeout = null;
        }
        if (tabTutorialHintEl) {
          tabTutorialHintEl.remove();
          tabTutorialHintEl = null;
        }
      }
      window.clearTabKeyHint = clearTabKeyHint;


























