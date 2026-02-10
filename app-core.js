const revealInput = document.getElementById("revealTime");
      const recallInput = document.getElementById("recallTime");
      const practiceStart = document.getElementById("practiceStart");
      const playStart = document.getElementById("playStart");
      const referenceOpen = document.getElementById("referenceOpen");
      const fullscreenToggle = document.getElementById("fullscreenToggle");
      const stagesOpen = document.getElementById("stagesOpen");
      const stagesScreen = document.getElementById("stagesScreen");
      const stagesBack = document.getElementById("stagesBack");
      const stagesPrev = document.getElementById("stagesPrev");
      const stagesNext = document.getElementById("stagesNext");
      const stagesFooter = document.getElementById("stagesFooter");
      const stageList = document.getElementById("stageList");
      const stageInstructions = document.getElementById("stageInstructions");
      const hudCluster = document.getElementById("hudCluster");
      const submitBtn = document.getElementById("submitBtn");
      const nextBtn = document.getElementById("nextBtn");
      const practiceModal = document.getElementById("practiceModal");
      const practiceCancel = document.getElementById("practiceCancel");
      const practiceConfirm = document.getElementById("practiceConfirm");
      const practiceDeselectAll = document.getElementById("practiceDeselectAll");
      const practiceSelectAll = document.getElementById("practiceSelectAll");
      const cardCountInput = document.getElementById("cardCount");
      const practicePlatformer = document.getElementById("practicePlatformer");
      const practiceGlitch = document.getElementById("practiceGlitch");
      const practiceFog = document.getElementById("practiceFog");
      const practiceAds = document.getElementById("practiceAds");
      const practiceSwap = document.getElementById("practiceSwap");
      const practiceMathChance = document.getElementById("practiceMathChance");
      const practiceMisleadChance = document.getElementById("practiceMisleadChance");
      const practiceBackgroundChance = document.getElementById("practiceBackgroundChance");
      const practiceSwapChance = document.getElementById("practiceSwapChance");
      const pauseModal = document.getElementById("pauseModal");
      const pauseResume = document.getElementById("pauseResume");
      const pauseRestart = document.getElementById("pauseRestart");
      const pauseQuit = document.getElementById("pauseQuit");
      const pauseButton = document.getElementById("pauseButton");
      const interruptModal = document.getElementById("interruptModal");
      const interruptClose = document.getElementById("interruptClose");
      const interruptCard = interruptModal
        ? interruptModal.querySelector(".interrupt-card")
        : null;
      const practiceMathOps = document.getElementById("practiceMathOps");
      const practiceMisleadColors = document.getElementById("practiceMisleadColors");
      const practiceBackgroundColor = document.getElementById("practiceBackgroundColor");
      const settingsOpen = document.getElementById("settingsOpen");
      const statsOpen = document.getElementById("statsOpen");
      const settingsModal = document.getElementById("settingsModal");
      const settingsClose = document.getElementById("settingsClose");
      const statsModal = document.getElementById("statsModal");
      const statsClose = document.getElementById("statsClose");
      const referenceModal = document.getElementById("referenceModal");
      const referenceClose = document.getElementById("referenceClose");
      const modeSelect = document.getElementById("modeSelect");
      const timerBar = document.getElementById("timerBar");
      const timerFill = document.getElementById("timerFill");
      const streakPill = document.getElementById("streakPill");
      const roundPill = document.getElementById("roundPill");
      const stageTimerHud = document.getElementById("stageTimerHud");
      const successAnimationToggle = document.getElementById("successAnimationToggle");
      const successToast = document.getElementById("successToast");
      const cardGrid = document.getElementById("cardGrid");
      const promptGrid = document.getElementById("promptGrid");
      const inputGrid = document.getElementById("inputGrid");
      const actions = document.querySelector(".stage .actions");
      const resultsPanel = document.getElementById("resultsPanel");
      const platformerPanel = document.getElementById("platformerPanel");
      const platformerCanvas = document.getElementById("platformerCanvas");
      const platformerCtx = platformerCanvas.getContext("2d");
      const fogCanvas = document.getElementById("fogCanvas");
      const fogCtx = fogCanvas.getContext("2d");
      const page = document.body;

      let phase = "idle";
      let round = 0;
      let roundStartTime = 0;
      let streak = 0;
      let timerId = null;
      let stageTimerId = null;
      let stageInstructionTimers = [];
      let stageInstructionToken = 0;
      let roundFlowToken = 0;
      let successAnimationEnabled = true;
      let successAnimationActive = false;
      let successAnimationPaused = false;
      let successAnimationStart = null;
      let successAnimationRemaining = 0;
      let successAnimationTimeoutId = null;
      let successAnimationPromise = null;
      let successAnimationResolve = null;
      const successAnimationDurationMs = 900;

      function bumpRoundFlowToken() {
        roundFlowToken += 1;
      }
      let roundItems = [];
      let roundItemsBase = [];
      let gameMode = "practice";
      let pausedState = null;
      let timerState = null;
      const platformerState = {
        enabled: false,
        completed: false,
        required: false,
        failed: false,
        player: { x: 20, y: 0, w: 16, h: 20, vx: 0, vy: 0 },
        start: { x: 20, y: 0 },
        platforms: [],
        pits: [],
        goal: { x: 0, y: 0, w: 12, h: 20 },
        keys: { left: false, right: false, jump: false }
      };
      let adTimer = null;
      let adEnabled = false;
      let adActive = false;
      let adShownThisRound = false;
      let pendingSkipAfterAd = false;
      let adSnapshot = null;
      let fogEnabled = false;
      let fogActive = false;
      let fogLastMove = { x: null, y: null, t: 0 };
      let glitchTimer = null;
      let swapEnabled = false;
      let swapChance = 1;
      let swapActive = false;
      let swapPair = null;
      let swapMap = null;
      const swapAnimationDuration = 1300;
      let swapTimeoutId = null;
      let swapStartTime = null;
      let swapRemaining = null;
      let swapStartRecall = null;
      let swapCleanup = null;
      const stageState = {
        active: false,
        index: 0,
        startTime: null,
        elapsedMs: 0,
        completed: false,
        failed: false,
        lastStars: 0,
        page: 0
      };
      let sessionStartTime = performance.now();
      let lastCompletedLevel = 0;
      let dragSelecting = false;
      let dragTargetState = null;
      function getSelectedCategories() {
        return Array.from(document.querySelectorAll(".checkboxes input:checked"))
          .map((checkbox) => checkbox.value)
          .filter((value) => dataSets[value]);
      }

      function getActiveCategories(currentRound) {
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          if (window.getStageCategories) {
            return window.getStageCategories(stage);
          }
          return ["numbers"];
        }
        return getSelectedCategories();
      }

      function getChallengeOptions(currentRound) {
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          if (window.getStageChallengeOptions) {
            return window.getStageChallengeOptions(stage);
          }
          return {
            enableMathOps: false,
            mathChance: 0.7,
            misleadColors: false,
            misleadChance: 0.6,
            enableBackgroundColor: false,
            backgroundColorChance: 0.35,
            enableGlitch: false
          };
        }
        return {
          enableMathOps: practiceMathOps.checked,
          mathChance: clamp(Number(practiceMathChance && practiceMathChance.value) || 0.7, 0, 1),
          misleadColors: practiceMisleadColors.checked,
          misleadChance: clamp(Number(practiceMisleadChance && practiceMisleadChance.value) || 0.6, 0, 1),
          enableBackgroundColor: practiceBackgroundColor.checked,
          backgroundColorChance: clamp(Number(practiceBackgroundChance && practiceBackgroundChance.value) || 0.35, 0, 1),
          enableGlitch: practiceGlitch.checked
        };
      }

      function isPlatformerEnabled() {
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          const modifiers = window.getStageModifiers ? window.getStageModifiers(stage) : null;
          return Boolean(modifiers && modifiers.platformer);
        }
        return Boolean(practicePlatformer.checked);
      }

      function isAdEnabled() {
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          const modifiers = window.getStageModifiers ? window.getStageModifiers(stage) : null;
          return Boolean(modifiers && modifiers.ads);
        }
        return Boolean(practiceAds.checked);
      }

      function isFogEnabled() {
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          const modifiers = window.getStageModifiers ? window.getStageModifiers(stage) : null;
          return Boolean(modifiers && modifiers.fog);
        }
        return Boolean(practiceFog.checked);
      }

      function isSwapEnabled() {
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          const modifiers = window.getStageModifiers ? window.getStageModifiers(stage) : null;
          return Boolean(modifiers && modifiers.swapCards);
        }
        return Boolean(practiceSwap && practiceSwap.checked);
      }

      function getSwapChance() {
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          const modifiers = window.getStageModifiers ? window.getStageModifiers(stage) : null;
          const value = modifiers && typeof modifiers.swapChance === "number" ? modifiers.swapChance : 1;
          return Math.max(0, Math.min(1, value));
        }
        return clamp(Number(practiceSwapChance && practiceSwapChance.value) || 1, 0, 1);
      }

      function skipRevealNow() {
        if (phase !== "show") return;
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
        timerState = null;
        clearAdTimer();
        pendingSkipAfterAd = false;
        adShownThisRound = true;
        if (adActive) {
          hideAd();
        }
        beginRecallPhase();
      }

      function updateModeUI() {
        gameMode = modeSelect.value;
        page.dataset.mode = gameMode;
        updateCategoryControls();
        updateScore();
        updateStreakVisibility();
      }

      function updateCategoryControls() {
        const disabled = gameMode !== "practice";
        document.querySelectorAll("#practiceModal .checkboxes input").forEach((input) => {
          input.disabled = disabled;
        });
        document.querySelectorAll("#practiceModal .stat-field input").forEach((input) => {
          input.disabled = disabled;
        });
        if (!disabled) {
          if (practiceMathOps) {
            practiceMathOps.disabled = false;
          }
          if (practiceMisleadColors) {
            practiceMisleadColors.disabled = false;
          }
          if (practiceBackgroundColor) {
            practiceBackgroundColor.disabled = false;
          }
          if (practiceGlitch) {
            practiceGlitch.disabled = false;
          }
          if (practiceFog) {
            practiceFog.disabled = false;
          }
          if (practiceAds) {
            practiceAds.disabled = false;
          }
          if (practiceSwap) {
            practiceSwap.disabled = false;
          }
        }
      }

      function setPhase(text, nextState) {
        if (nextState) {
          phase = nextState;
          page.dataset.state = nextState;
        }
        updateRoundVisibility();
        updateStreakVisibility();
        updateStageTimerVisibility();
        renderStageInstructions();
        if (nextState === "idle") {
          document.body.classList.remove("show-pause");
          document.body.classList.remove("pause-hint");
        }
      }

      function toPercent(value) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return null;
        return numberValue <= 1 ? numberValue * 100 : numberValue;
      }

      function renderStageInstructions() {
        if (!stageInstructions) return;
        stageInstructionToken += 1;
        stageInstructionTimers.forEach((timerId) => clearTimeout(timerId));
        stageInstructionTimers = [];
        stageInstructions.innerHTML = "";
        if (gameMode !== "stages") return;
        if (phase !== "show" && phase !== "recall" && phase !== "result") return;
        const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
        if (!stage || !window.getStageInstructionSlides) return;
        const instructionData = window.getStageInstructionSlides(stage);
        const slides = instructionData && instructionData.slides ? instructionData.slides : [];
        const resultEntries = instructionData && instructionData.result ? instructionData.result : [];
        if (phase === "result") {
          if (!stageState || !stageState.completed) return;
          if (!Array.isArray(resultEntries) || !resultEntries.length) return;
          scheduleInstructionEntries(resultEntries);
          return;
        }
        if (!Array.isArray(slides) || !slides.length) return;
        const currentRound = Math.max(1, Number(round) || 1);
        const slideIndex = (currentRound - 1) * 2 + (phase === "show" ? 0 : 1);
        const entries = slides[slideIndex];
        if (!Array.isArray(entries) || !entries.length) return;
        scheduleInstructionEntries(entries);
      }

      function scheduleInstructionEntries(entries) {
        const renderToken = stageInstructionToken;
        const fadeMs = 500;
        const showEntry = (entry) => {
          if (renderToken !== stageInstructionToken) return;
          if (!entry || typeof entry.text !== "string" || !entry.text.trim()) return;
          const box = document.createElement("div");
          box.className = "stage-instruction";
          if (entry.className) {
            String(entry.className)
              .split(" ")
              .filter(Boolean)
              .forEach((cls) => box.classList.add(cls));
          }
          const rawText = entry.text;
          const safeText = String(rawText).replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const formatted = safeText.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
          box.innerHTML = `<span class="stage-instruction__text">${formatted}</span>`;
          const left = toPercent(entry.x);
          const top = toPercent(entry.y);
          const width = toPercent(entry.w);
          const height = toPercent(entry.h);
          if (left !== null) box.style.left = `${left}%`;
          if (top !== null) box.style.top = `${top}%`;
          if (width !== null) box.style.width = `${width}%`;
          if (height !== null) box.style.height = `${height}%`;
          if (entry.align) {
            box.style.textAlign = entry.align;
          }
          if (entry.size) {
            box.style.fontSize = entry.size;
          }
          if (entry.color) {
            box.style.color = entry.color;
          }
          stageInstructions.appendChild(box);
          requestAnimationFrame(() => {
            if (renderToken !== stageInstructionToken) return;
            box.classList.add("is-visible");
          });
          const duration = Number(entry.duration);
          if (Number.isFinite(duration) && duration > 0) {
            const hideId = window.setTimeout(() => {
              if (renderToken !== stageInstructionToken) return;
              box.classList.remove("is-visible");
              box.classList.add("is-hidden");
              const removeId = window.setTimeout(() => {
                if (renderToken !== stageInstructionToken) return;
                box.remove();
              }, fadeMs);
              stageInstructionTimers.push(removeId);
            }, duration);
            stageInstructionTimers.push(hideId);
          }
        };
        entries.forEach((entry) => {
          const delay = Number(entry && entry.at);
          if (Number.isFinite(delay) && delay > 0) {
            const timerId = window.setTimeout(() => showEntry(entry), delay);
            stageInstructionTimers.push(timerId);
          } else {
            showEntry(entry);
          }
        });
      }

      function updateScore() {
        const stage = gameMode === "stages" && window.getStageConfig ? window.getStageConfig(stageState.index) : null;
        if (gameMode === "stages" && stage) {
          roundPill.textContent = `Round ${round}/${stage.rounds || 1}`;
        } else {
          roundPill.textContent = `Round ${round}`;
        }
        if (streakPill) {
          streakPill.textContent = `STREAK ${streak}`;
        }
        updateRoundVisibility();
        updateStageTimerVisibility();
      }

      function updateRoundVisibility() {
        if (!roundPill) return;
        const showRound = gameMode !== "practice" && phase !== "idle" && phase !== "result";
        roundPill.style.display = showRound ? "block" : "none";
      }

      function updateStreakVisibility() {
        if (!streakPill) return;
        const showStreak = gameMode === "practice" && phase !== "idle";
        streakPill.style.display = showStreak ? "block" : "none";
      }

      function updateStageTimerVisibility() {
        if (!stageTimerHud) return;
        const showStageTimer = gameMode === "stages" && phase !== "idle" && phase !== "result";
        stageTimerHud.style.display = showStageTimer ? "block" : "none";
        if (hudCluster) {
          hudCluster.style.display = showStageTimer ? "flex" : "none";
        }
        if (!showStageTimer) {
          stageTimerHud.textContent = "Time 0.00";
        }
      }

      function setSuccessAnimationEnabled(enabled) {
        successAnimationEnabled = Boolean(enabled);
      }

      function pauseSuccessAnimation() {
        if (!successAnimationActive || successAnimationPaused || !successToast) return;
        successAnimationPaused = true;
        if (successAnimationTimeoutId) {
          clearTimeout(successAnimationTimeoutId);
          successAnimationTimeoutId = null;
        }
        if (successAnimationStart) {
          const elapsed = performance.now() - successAnimationStart;
          successAnimationRemaining = Math.max(0, successAnimationRemaining - elapsed);
        }
        successAnimationStart = null;
        successToast.style.animationPlayState = "paused";
      }

      function resumeSuccessAnimation() {
        if (!successAnimationActive || !successAnimationPaused || !successToast) return;
        successAnimationPaused = false;
        successAnimationStart = performance.now();
        successToast.style.animationPlayState = "running";
        successAnimationTimeoutId = window.setTimeout(() => {
          finishSuccessAnimation();
        }, successAnimationRemaining);
      }

      function finishSuccessAnimation() {
        if (!successAnimationActive) return;
        if (successAnimationTimeoutId) {
          clearTimeout(successAnimationTimeoutId);
          successAnimationTimeoutId = null;
        }
        successToast.classList.remove("show");
        successAnimationActive = false;
        successAnimationPaused = false;
        successAnimationStart = null;
        successAnimationRemaining = 0;
        successAnimationPromise = null;
        if (typeof successAnimationResolve === "function") {
          successAnimationResolve();
        }
        successAnimationResolve = null;
      }

      function cancelSuccessAnimation() {
        if (!successAnimationActive) return;
        if (successAnimationTimeoutId) {
          clearTimeout(successAnimationTimeoutId);
          successAnimationTimeoutId = null;
        }
        if (successToast) {
          successToast.classList.remove("show");
          successToast.style.animationPlayState = "";
        }
        successAnimationActive = false;
        successAnimationPaused = false;
        successAnimationStart = null;
        successAnimationRemaining = 0;
        successAnimationPromise = null;
        if (typeof successAnimationResolve === "function") {
          successAnimationResolve();
        }
        successAnimationResolve = null;
      }

      function playSuccessAnimation() {
        if (!successAnimationEnabled || !successToast) {
          return Promise.resolve();
        }
        if (successAnimationActive && successAnimationPromise) {
          return successAnimationPromise;
        }
        successAnimationActive = true;
        successAnimationPaused = false;
        const shouldPauseStageTimer = gameMode === "stages" && typeof stopStageStopwatch === "function";
        const wasStageTimerRunning = shouldPauseStageTimer && stageTimerId;
        if (wasStageTimerRunning) {
          stopStageStopwatch();
        }
        successToast.classList.remove("show");
        void successToast.offsetWidth;
        successToast.classList.add("show");
        successToast.style.animationPlayState = "running";
        successAnimationRemaining = successAnimationDurationMs;
        successAnimationStart = performance.now();
        successAnimationPromise = new Promise((resolve) => {
          successAnimationResolve = resolve;
          successAnimationTimeoutId = window.setTimeout(() => {
            if (wasStageTimerRunning && typeof startStageStopwatch === "function") {
              if (stageState && typeof stageState.startTime === "number") {
                stageState.startTime += successAnimationDurationMs;
              }
              if (!document.body.classList.contains("pause-active")) {
                startStageStopwatch();
              }
            }
            finishSuccessAnimation();
          }, successAnimationRemaining);
        });
        return successAnimationPromise;
      }

      function resetStageProgress() {
        stageState.active = false;
        stageState.startTime = null;
        stageState.elapsedMs = 0;
        stageState.completed = false;
        stageState.failed = false;
        stageState.lastStars = 0;
      }

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }


      function resetBoard() {
        cardGrid.innerHTML = "";
        if (promptGrid) {
          promptGrid.innerHTML = "";
        }
        inputGrid.innerHTML = "";
        resultsPanel.classList.remove("show");
        resultsPanel.innerHTML = "";
      }

      function normalize(value) {
        return value.trim().toLowerCase();
      }

      function formatCategoryLabel(category) {
        switch (category) {
          case "numbers":
            return "Number";
          case "letters":
            return "Letter";
          case "colors":
            return "Color";
          case "directions":
            return "Direction";
          case "shapes":
            return "Shape";
          default:
            return category ? category[0].toUpperCase() + category.slice(1) : "Card";
        }
      }

      function renderShapeSVG(shape) {
        if (shape === "circle") {
          return `
            <svg class="shape-svg" viewBox="0 0 100 100" aria-hidden="true">
              <circle class="shape-stroke" cx="50" cy="50" r="30"></circle>
            </svg>
          `;
        }
        if (shape === "square") {
          return `
            <svg class="shape-svg" viewBox="0 0 100 100" aria-hidden="true">
              <rect class="shape-stroke" x="24" y="24" width="52" height="52"></rect>
            </svg>
          `;
        }
        return `
          <svg class="shape-svg" viewBox="0 0 100 100" aria-hidden="true">
            <polygon class="shape-stroke" points="50,18 82,82 18,82"></polygon>
          </svg>
        `;
      }

      function isCorrectAnswer(item, actualValue) {
        if (!actualValue || !String(actualValue).trim()) {
          return false;
        }
        const actual = normalize(actualValue);
        const expected = normalize(item.answer ?? item.label);
        if (item.category === "colors") {
          const initial = expected.charAt(0);
          return actual === expected || actual === initial;
        }
        if (item.category === "directions") {
          const initial = expected.charAt(0);
          return actual === expected || actual === initial;
        }
        if (item.category === "shapes") {
          if (expected === "square") {
            return actual === "square" || actual === "s" || actual === "rectangle" || actual === "r";
          }
          const initial = expected.charAt(0);
          return actual === expected || actual === initial;
        }
        if (item.recallHint === "Background color") {
          const initial = expected.charAt(0);
          return actual === expected || actual === initial;
        }
        return actual === expected;
      }

      function buildChallenge(item, options) {
        const challenge = {
          ...item,
          answer: item.label,
          recallHint: null,
          textLabel: null,
          colorTarget: null,
          backgroundColorLabel: null,
          backgroundColorHex: null
        };
        if (item.category === "colors") {
          if (options.misleadColors && Math.random() < options.misleadChance) {
            challenge.misleadingLabel = pickMisleadingLabel(item.label);
          }
          challenge.textLabel = challenge.misleadingLabel || challenge.label;
          const allowBackground = Boolean(options.enableBackgroundColor);
          const bgChance =
            typeof options.backgroundColorChance === "number" ? options.backgroundColorChance : 0.5;
          challenge.colorTarget = allowBackground && Math.random() < bgChance ? "background" : "text";
          if (challenge.colorTarget === "background") {
            challenge.answer = challenge.label;
            challenge.recallHint = "Background color";
          } else {
            challenge.answer = challenge.textLabel;
            challenge.recallHint = "Color text";
          }
        } else if (options.enableBackgroundColor) {
          const bgChance =
            typeof options.backgroundColorChance === "number" ? options.backgroundColorChance : 0.5;
          if (Math.random() < bgChance) {
            const backgroundColor = pickBackgroundColor();
            challenge.backgroundColorLabel = backgroundColor.label;
            challenge.backgroundColorHex = backgroundColor.color;
            const promptChance =
              typeof options.backgroundPromptChance === "number" ? options.backgroundPromptChance : 0.5;
            if (Math.random() < promptChance) {
              challenge.answer = backgroundColor.label;
              challenge.recallHint = "Background color";
            }
          }
        }
        return challenge;
      }

      function pickItems() {
        const categories = getActiveCategories(round);
        const options = getChallengeOptions(round);
        const count =
          gameMode === "practice"
            ? Number(cardCountInput.value || 4)
            : gameMode === "stages"
                ? (window.getStageCardCount
                    ? window.getStageCardCount(
                        window.getStageConfig ? window.getStageConfig(stageState.index) : null
                      )
                    : 4)
                : 1;
        const uniquePool = categories.reduce((total, category) => {
          const list = dataSets[category];
          return total + (Array.isArray(list) ? list.length : 0);
        }, 0);
        const targetCount = Math.max(1, count);
        const allowDuplicates = uniquePool > 0 && count > uniquePool;
        const chosen = [];
        const used = new Set();
        while (chosen.length < targetCount) {
          const category = categories[Math.floor(Math.random() * categories.length)];
          const list = dataSets[category];
          const rawItem = list[Math.floor(Math.random() * list.length)];
          const item = typeof rawItem === "string" ? { label: rawItem } : rawItem;
          const key = `${category}-${item.label}`.toLowerCase();
          if (!allowDuplicates) {
            if (used.has(key)) continue;
            used.add(key);
          }
          chosen.push(buildChallenge({ ...item, category }, options));
        }
        return applyNumberChallenges(chosen, options);
      }


      function renderCards(show) {
        cardGrid.innerHTML = "";
        roundItems.forEach((item, index) => {
          const card = document.createElement("div");
          const hintClass = !show && item.recallHint ? " hidden-card hint" : " hidden-card";
          card.className = `card ${show ? "" : hintClass}`.trim();
          card.style.order = index;
          card.dataset.index = index;
          if (show) {
            if (item.category === "directions") {
              card.innerHTML = `<small>${item.category}</small><span class="direction-symbol">${item.symbol}</span>`;
            } else if (item.category === "shapes") {
              card.innerHTML = `<small>${item.category}</small>${renderShapeSVG(item.shape)}`;
            } else {
              const cardLabel = item.textLabel ?? item.label;
              const symbol = item.symbol ? `${item.symbol} ` : "";
              card.innerHTML = `<small>${item.category}</small>${symbol}${cardLabel}`;
            }
            if (item.color) {
              card.style.background = item.color;
              card.style.color = "#0f172a";
            } else if (item.backgroundColorHex) {
              card.style.background = item.backgroundColorHex;
              card.style.color = "#0f172a";
              card.classList.add("background-color");
            }
          } else {
            const cardLabel = `Card ${index + 1}`;
            const categoryLabel = formatCategoryLabel(item.category);
            if (item.recallHint) {
              card.innerHTML = `
                <small>${cardLabel}</small>
                <span>${item.recallHint}</span>
              `;
            } else {
              card.innerHTML = `
                <small>${cardLabel}</small>
                <span>${categoryLabel}</span>
              `;
            }
          }
        cardGrid.appendChild(card);
      });
    }

      function renderInputs() {
        inputGrid.innerHTML = "";
        roundItems.forEach((item, index) => {
          const wrapper = document.createElement("div");
          wrapper.className = "input-slot";
          const input = document.createElement("input");
          input.type = "text";
          input.placeholder = "";
          input.dataset.index = index;
          wrapper.appendChild(input);
          inputGrid.appendChild(wrapper);
        });
      }
