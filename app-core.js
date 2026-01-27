const revealInput = document.getElementById("revealTime");
      const recallInput = document.getElementById("recallTime");
      const practiceStart = document.getElementById("practiceStart");
      const tutorialStart = document.getElementById("tutorialStart");
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
      const phasePill = document.getElementById("phasePill");
      const timerPill = document.getElementById("timerPill");
      const stageTimerPill = document.getElementById("stageTimerPill");
      const timerBar = document.getElementById("timerBar");
      const timerFill = document.getElementById("timerFill");
      const modePill = document.getElementById("modePill");
      const streakPill = document.getElementById("streakPill");
      const roundPill = document.getElementById("roundPill");
      const scorePill = document.getElementById("scorePill");
      const livesPill = document.getElementById("livesPill");
      const cardGrid = document.getElementById("cardGrid");
      const promptGrid = document.getElementById("promptGrid");
      const inputGrid = document.getElementById("inputGrid");
      const resultsPanel = document.getElementById("resultsPanel");
      const tutorialMessage = document.getElementById("tutorialMessage");
      const tutorialRecallMessage = document.getElementById("tutorialRecallMessage");
      const platformerPanel = document.getElementById("platformerPanel");
      const platformerCanvas = document.getElementById("platformerCanvas");
      const platformerCtx = platformerCanvas.getContext("2d");
      const fogCanvas = document.getElementById("fogCanvas");
      const fogCtx = fogCanvas.getContext("2d");
      const page = document.body;

      let phase = "idle";
      let round = 0;
      let streak = 0;
      let timerId = null;
      let roundItems = [];
      let roundItemsBase = [];
      let gameMode = "practice";
      let pausedState = null;
      let timerState = null;
      let stageTimerId = null;
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
      let swapActive = false;
      let swapPair = null;
      let swapMap = null;
      const swapAnimationDuration = 1300;
      let swapTimeoutId = null;
      let swapStartTime = null;
      let swapRemaining = null;
      let swapStartRecall = null;
      let swapCleanup = null;
      const tutorialState = {
        stepIndex: 0,
        currentStep: null,
        completed: false
      };
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
      let dragSelecting = false;
      let dragTargetState = null;
      function getSelectedCategories() {
        return Array.from(document.querySelectorAll(".checkboxes input:checked"))
          .map((checkbox) => checkbox.value)
          .filter((value) => dataSets[value]);
      }

      function getActiveCategories(currentRound) {
        if (gameMode === "endless") {
          if (window.getEndlessCategories) {
            return window.getEndlessCategories(currentRound);
          }
          return ["numbers"];
        }
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
        if (gameMode === "endless") {
          if (window.getEndlessChallengeOptions) {
            return window.getEndlessChallengeOptions(currentRound);
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
          mathChance: 0.7,
          misleadColors: practiceMisleadColors.checked,
          misleadChance: 0.6,
          enableBackgroundColor: practiceBackgroundColor.checked,
          backgroundColorChance: 0.35,
          enableGlitch: practiceGlitch.checked
        };
      }

      function isPlatformerEnabled() {
        if (gameMode === "endless") {
          return Boolean(window.getEndlessModifiers && window.getEndlessModifiers(round).platformer);
        }
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          const modifiers = window.getStageModifiers ? window.getStageModifiers(stage) : null;
          return Boolean(modifiers && modifiers.platformer);
        }
        return Boolean(practicePlatformer.checked);
      }

      function isAdEnabled() {
        if (gameMode === "endless") {
          return Boolean(window.getEndlessModifiers && window.getEndlessModifiers(round).ads);
        }
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          const modifiers = window.getStageModifiers ? window.getStageModifiers(stage) : null;
          return Boolean(modifiers && modifiers.ads);
        }
        return Boolean(practiceAds.checked);
      }

      function isFogEnabled() {
        if (gameMode === "endless") {
          return Boolean(window.getEndlessModifiers && window.getEndlessModifiers(round).fog);
        }
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          const modifiers = window.getStageModifiers ? window.getStageModifiers(stage) : null;
          return Boolean(modifiers && modifiers.fog);
        }
        return Boolean(practiceFog.checked);
      }

      function isSwapEnabled() {
        if (gameMode === "endless") {
          return Boolean(window.getEndlessModifiers && window.getEndlessModifiers(round).swapCards);
        }
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          const modifiers = window.getStageModifiers ? window.getStageModifiers(stage) : null;
          return Boolean(modifiers && modifiers.swapCards);
        }
        return Boolean(practiceSwap && practiceSwap.checked);
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
        document.querySelectorAll(".checkboxes input").forEach((input) => {
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
        phasePill.textContent = text;
        if (nextState) {
          phase = nextState;
          page.dataset.state = nextState;
        }
        if (tutorialRecallMessage && (!nextState || nextState !== "recall")) {
          tutorialRecallMessage.style.display = "none";
        }
        updateRoundVisibility();
        updateStreakVisibility();
        updateStageTimerVisibility();
        if (nextState === "idle") {
          document.body.classList.remove("show-pause");
          document.body.classList.remove("pause-hint");
        }
      }

      function updateScore() {
        const stage = gameMode === "stages" && window.getStageConfig ? window.getStageConfig(stageState.index) : null;
        if (gameMode === "stages" && stage) {
          roundPill.textContent = `Round ${round}/${stage.rounds || 1}`;
        } else {
          roundPill.textContent = `Round ${round}`;
        }
        if (gameMode === "endless") {
          modePill.textContent = "Mode: Endless";
          scorePill.textContent = "Score -";
          livesPill.textContent = "Lives -";
        } else if (gameMode === "tutorial") {
          modePill.textContent = "Mode: Tutorial";
          scorePill.textContent = "Score -";
          livesPill.textContent = "Lives -";
        } else if (gameMode === "stages") {
          const stageLabel = stage ? stage.name || `Stage ${stage.id || stageState.index + 1}` : "Stages";
          modePill.textContent = `Mode: ${stageLabel}`;
          scorePill.textContent = "Score -";
          livesPill.textContent = "Lives -";
        } else {
          modePill.textContent = "Mode: Practice";
          scorePill.textContent = "Score -";
          livesPill.textContent = "Lives -";
        }
        if (streakPill) {
          streakPill.textContent = `STREAK ${streak}`;
        }
        updateRoundVisibility();
        updateStageTimerVisibility();
      }

      function updateRoundVisibility() {
        if (!roundPill) return;
        const showRound = gameMode !== "practice" && phase !== "idle";
        roundPill.style.display = showRound ? "block" : "none";
      }

      function updateStreakVisibility() {
        if (!streakPill) return;
        const showStreak = (gameMode === "practice" || gameMode === "endless") && phase !== "idle";
        streakPill.style.display = showStreak ? "block" : "none";
      }

      function updateStageTimerVisibility() {
        if (!stageTimerPill) return;
        const showStageTimer = gameMode === "stages" && phase !== "idle";
        stageTimerPill.style.display = showStageTimer ? "block" : "none";
        if (!showStageTimer) {
          stageTimerPill.textContent = "Time 0.00";
        }
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
          challenge.colorTarget = allowBackground && Math.random() < 0.5 ? "background" : "text";
          if (challenge.colorTarget === "background") {
            challenge.answer = challenge.label;
            challenge.recallHint = "Background color";
          } else {
            challenge.answer = challenge.textLabel;
            challenge.recallHint = "Color text";
          }
        } else if (options.enableBackgroundColor && Math.random() < options.backgroundColorChance) {
          const backgroundColor = pickBackgroundColor();
          challenge.backgroundColorLabel = backgroundColor.label;
          challenge.backgroundColorHex = backgroundColor.color;
          challenge.answer = backgroundColor.label;
          challenge.recallHint = "Background color";
        }
        return challenge;
      }

      function pickItems() {
        const categories = getActiveCategories(round);
        const options = getChallengeOptions(round);
        const count =
          gameMode === "practice"
            ? Number(cardCountInput.value || 4)
            : gameMode === "endless"
              ? (window.getEndlessCardCount ? window.getEndlessCardCount(round) : 3)
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

      function resolveTutorialMessageCoord(value) {
        if (value === null || value === undefined) return null;
        if (typeof value === "number" && Number.isFinite(value)) {
          return `${value}rem`;
        }
        if (typeof value === "string") {
          return value.trim();
        }
        return null;
      }

      function applyTutorialMessagePosition(step) {
        if (!tutorialMessage) return;
        const position = step && step.messagePosition ? step.messagePosition : null;
        if (!position) {
          tutorialMessage.style.left = "";
          tutorialMessage.style.top = "";
          tutorialMessage.style.transform = "";
          return;
        }
        const left = resolveTutorialMessageCoord(position.x);
        const top = resolveTutorialMessageCoord(position.y);
        if (left) {
          tutorialMessage.style.left = left;
        } else {
          tutorialMessage.style.left = "";
        }
        if (top) {
          tutorialMessage.style.top = top;
        } else {
          tutorialMessage.style.top = "";
        }
        if (position.center === true) {
          tutorialMessage.style.transform = "translateX(-50%)";
        } else if (left) {
          tutorialMessage.style.transform = "none";
        } else {
          tutorialMessage.style.transform = "";
        }
      }

      function applyTutorialRecallMessagePosition(step) {
        if (!tutorialRecallMessage) return;
        const position = step && step.recallMessagePosition ? step.recallMessagePosition : null;
        if (!position) {
          tutorialRecallMessage.style.left = "";
          tutorialRecallMessage.style.top = "";
          tutorialRecallMessage.style.transform = "";
          return;
        }
        const left = resolveTutorialMessageCoord(position.x);
        const top = resolveTutorialMessageCoord(position.y);
        if (left) {
          tutorialRecallMessage.style.left = left;
        } else {
          tutorialRecallMessage.style.left = "";
        }
        if (top) {
          tutorialRecallMessage.style.top = top;
        } else {
          tutorialRecallMessage.style.top = "";
        }
        if (position.center === true) {
          tutorialRecallMessage.style.transform = "translateX(-50%)";
        } else if (left) {
          tutorialRecallMessage.style.transform = "none";
        } else {
          tutorialRecallMessage.style.transform = "";
        }
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
