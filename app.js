const revealInput = document.getElementById("revealTime");
      const recallInput = document.getElementById("recallTime");
      const practiceStart = document.getElementById("practiceStart");
      const adventureStart = document.getElementById("adventureStart");
      const referenceOpen = document.getElementById("referenceOpen");
      const submitBtn = document.getElementById("submitBtn");
      const nextBtn = document.getElementById("nextBtn");
      const practiceModal = document.getElementById("practiceModal");
      const practiceCancel = document.getElementById("practiceCancel");
      const practiceConfirm = document.getElementById("practiceConfirm");
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
      const interruptModal = document.getElementById("interruptModal");
      const interruptClose = document.getElementById("interruptClose");
      const interruptCard = interruptModal
        ? interruptModal.querySelector(".interrupt-card")
        : null;
      const practiceMathOps = document.getElementById("practiceMathOps");
      const practiceMisleadColors = document.getElementById("practiceMisleadColors");
      const practiceBackgroundColor = document.getElementById("practiceBackgroundColor");
      const referenceModal = document.getElementById("referenceModal");
      const referenceClose = document.getElementById("referenceClose");
      const modeSelect = document.getElementById("modeSelect");
      const phasePill = document.getElementById("phasePill");
      const timerPill = document.getElementById("timerPill");
      const timerBar = document.getElementById("timerBar");
      const timerFill = document.getElementById("timerFill");
      const modePill = document.getElementById("modePill");
      const streakPill = document.getElementById("streakPill");
      const roundPill = document.getElementById("roundPill");
      const scorePill = document.getElementById("scorePill");
      const livesPill = document.getElementById("livesPill");
      const cardGrid = document.getElementById("cardGrid");
      const inputGrid = document.getElementById("inputGrid");
      const resultsPanel = document.getElementById("resultsPanel");
      const draftPanel = document.getElementById("draftPanel");
      const draftGrid = document.getElementById("draftGrid");
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
      const swapAnimationDuration = 1600;
      let dragSelecting = false;
      let dragTargetState = null;
      const adventureState = {
        lives: 3,
        score: 0,
        difficulty: 0,
        modifiers: {
          revealPenalty: 0,
          cardCount: 1,
          swapCards: false
        },
        unlockedCategories: ["numbers"]
      };
      function getSelectedCategories() {
        return Array.from(document.querySelectorAll(".checkboxes input:checked"))
          .map((checkbox) => checkbox.value)
          .filter((value) => dataSets[value]);
      }

      function getActiveCategories(currentRound) {
        if (gameMode === "adventure") {
          return [...adventureState.unlockedCategories];
        }
        return getSelectedCategories();
      }

      function getChallengeOptions(currentRound) {
        if (gameMode === "adventure") {
          const colorsUnlocked = adventureState.unlockedCategories.includes("colors");
          return {
            enableMathOps: Boolean(adventureState.modifiers.mathOps),
            mathChance: 0.6,
            misleadColors: colorsUnlocked && Boolean(adventureState.modifiers.misleadColors),
            misleadChance: 0.6,
            enableBackgroundColor: Boolean(adventureState.modifiers.backgroundColor),
            backgroundColorChance: 0.35,
            enableGlitch: Boolean(adventureState.modifiers.glitch)
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

      function setGlitchActive(active) {
        document.querySelectorAll(".card").forEach((card) => {
          if (active) {
            card.classList.add("glitch", "active");
          } else {
            card.classList.remove("active");
          }
        });
      }

      function startGlitching() {
        stopGlitching();
        if (!getChallengeOptions(round).enableGlitch) return;
        glitchTimer = setInterval(() => {
          const flicker = Math.random() < 0.4;
          setGlitchActive(flicker);
          if (!flicker) {
            setGlitchActive(false);
          }
        }, 350);
      }

      function stopGlitching() {
        if (glitchTimer) {
          clearInterval(glitchTimer);
          glitchTimer = null;
        }
        setGlitchActive(false);
      }

      function isPlatformerEnabled() {
        return gameMode === "adventure"
          ? Boolean(adventureState.modifiers.platformer)
          : Boolean(practicePlatformer.checked);
      }

      function isAdEnabled() {
        return gameMode === "adventure"
          ? Boolean(adventureState.modifiers.ads)
          : Boolean(practiceAds.checked);
      }

      function isFogEnabled() {
        return gameMode === "adventure"
          ? Boolean(adventureState.modifiers.fog)
          : Boolean(practiceFog.checked);
      }

      function isSwapEnabled() {
        return gameMode === "adventure"
          ? Boolean(adventureState.modifiers.swapCards)
          : Boolean(practiceSwap && practiceSwap.checked);
      }

      function showAd(options = {}) {
        const { reuseSnapshot = false } = options;
        if (!adEnabled) return;
        if (adActive) return;
        if (pauseModal.classList.contains("show")) return;
        if (phase !== "show") return;
        if (!interruptModal) return;
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
        setModalState(interruptModal, true);
        interruptModal.style.display = "grid";
        positionAd(reuseSnapshot);
        adActive = true;
        adShownThisRound = true;
      }

      function hideAd() {
        setModalState(interruptModal, false);
        interruptModal.style.display = "none";
        adActive = false;
      }

      function setAdInteractive(enabled) {
        if (!interruptModal) return;
        if (interruptClose) {
          interruptClose.disabled = !enabled;
        }
        interruptModal.style.pointerEvents = enabled ? "auto" : "none";
      }

      function clearAdTimer() {
        if (adTimer) {
          clearTimeout(adTimer);
          adTimer = null;
        }
      }

      function resizeFog() {
        if (!fogCanvas) return;
        fogCanvas.width = window.innerWidth;
        fogCanvas.height = window.innerHeight;
      }

      function drawFog() {
        if (!fogCtx || !fogCanvas) return;
        fogCtx.globalCompositeOperation = "source-over";
        fogCtx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
        const fogCount = Math.round((fogCanvas.width * fogCanvas.height) / 90000);
        for (let i = 0; i < fogCount; i += 1) {
          const x = Math.random() * fogCanvas.width;
          const y = Math.random() * fogCanvas.height;
          const radius = 60 + Math.random() * 120;
          const gradient = fogCtx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
          gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
          gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
          fogCtx.fillStyle = gradient;
          fogCtx.beginPath();
          fogCtx.arc(x, y, radius, 0, Math.PI * 2);
          fogCtx.fill();
        }
      }

      function startFog() {
        if (!fogCanvas) return;
        fogActive = true;
        fogCanvas.style.display = "block";
        resizeFog();
        drawFog();
        fogLastMove = { x: null, y: null, t: 0 };
      }

      function stopFog() {
        fogActive = false;
        if (fogCanvas) {
          fogCanvas.style.display = "none";
        }
      }

      function clearFogAt(x, y, speed, lastX, lastY) {
        if (!fogCtx || !fogCanvas) return;
        const strength = Math.min(1, speed / 1.1);
        const width = 24 + strength * 60;
        fogCtx.globalCompositeOperation = "destination-out";
        fogCtx.lineCap = "round";
        fogCtx.lineJoin = "round";
        fogCtx.lineWidth = width;
        fogCtx.beginPath();
        if (lastX !== null && lastY !== null) {
          fogCtx.moveTo(lastX, lastY);
        } else {
          fogCtx.moveTo(x, y);
        }
        fogCtx.lineTo(x, y);
        fogCtx.stroke();
        fogCtx.beginPath();
        fogCtx.arc(x, y, width * 0.6, 0, Math.PI * 2);
        fogCtx.fill();
        fogCtx.globalCompositeOperation = "source-over";
      }

      function positionAd(reuseSnapshot) {
        if (!interruptModal || !interruptCard || !cardGrid) return;
        if (reuseSnapshot && adSnapshot) {
          interruptCard.style.width = `${adSnapshot.w}px`;
          interruptCard.style.minHeight = `${adSnapshot.h}px`;
          interruptModal.style.left = `${adSnapshot.left}px`;
          interruptModal.style.top = `${adSnapshot.top}px`;
          return;
        }
        const sizeOptions = [
          { w: 240, h: 140 },
          { w: 280, h: 160 },
          { w: 320, h: 180 },
          { w: 360, h: 200 }
        ];
        const chosenSize = sizeOptions[Math.floor(Math.random() * sizeOptions.length)];
        interruptCard.style.width = `${chosenSize.w}px`;
        interruptCard.style.minHeight = `${chosenSize.h}px`;
        const gridRect = cardGrid.getBoundingClientRect();
        const cardRect = interruptCard.getBoundingClientRect();
        const overflow = 24;
        const safePadding = 8;
        let minLeft = gridRect.left - overflow;
        let maxLeft = gridRect.right - cardRect.width + overflow;
        let minTop = gridRect.top - overflow;
        let maxTop = gridRect.bottom - cardRect.height + overflow;
        const maxLeftBound = window.innerWidth - cardRect.width - safePadding;
        const maxTopBound = window.innerHeight - cardRect.height - safePadding;
        minLeft = Math.max(minLeft, safePadding);
        maxLeft = Math.min(maxLeft, maxLeftBound);
        minTop = Math.max(minTop, safePadding);
        maxTop = Math.min(maxTop, maxTopBound);
        const left = minLeft + Math.random() * Math.max(0, maxLeft - minLeft);
        const top = minTop + Math.random() * Math.max(0, maxTop - minTop);
        interruptModal.style.left = `${left}px`;
        interruptModal.style.top = `${top}px`;
        adSnapshot = {
          left,
          top,
          w: chosenSize.w,
          h: chosenSize.h
        };
      }

      function scheduleAd(revealSeconds) {
        clearAdTimer();
        if (!adEnabled) return;
        const thirdWindow = Math.max(0.1, revealSeconds / 3);
        const minDelay = 0.05;
        const maxDelay = Math.max(minDelay, thirdWindow - 0.1);
        const delaySeconds = minDelay + Math.random() * (maxDelay - minDelay);
        adTimer = setTimeout(() => {
          requestAnimationFrame(() => {
            showAd();
          });
        }, delaySeconds * 1000);
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
        const disabled = gameMode === "adventure";
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
        updateStreakVisibility();
      }

      function updateScore() {
        roundPill.textContent = `Round ${round}`;
        if (gameMode === "adventure") {
          modePill.textContent = "Mode: Adventure";
          scorePill.textContent = `Score ${adventureState.score}`;
          livesPill.textContent = `Lives ${adventureState.lives}`;
        } else {
          modePill.textContent = "Mode: Practice";
          scorePill.textContent = "Score -";
          livesPill.textContent = "Lives -";
        }
        if (streakPill) {
          streakPill.textContent = `STREAK ${streak}`;
        }
      }

      function updateStreakVisibility() {
        if (!streakPill) return;
        const showStreak = gameMode === "practice" && phase !== "idle";
        streakPill.style.display = showStreak ? "block" : "none";
      }

      function pickSwapPair(count) {
        if (count < 2) return null;
        const pairs = [];
        for (let i = 0; i < count - 1; i += 1) {
          for (let j = i + 1; j < count; j += 1) {
            pairs.push([i, j]);
          }
        }
        const pick = Math.floor(Math.random() * (pairs.length + 1));
        if (pick >= pairs.length) {
          return null;
        }
        return pairs[pick];
      }


      function resetBoard() {
        cardGrid.innerHTML = "";
        inputGrid.innerHTML = "";
        resultsPanel.classList.remove("show");
        resultsPanel.innerHTML = "";
        draftGrid.innerHTML = "";
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

      function pickMisleadingLabel(actualLabel) {
        const options = dataSets.colors
          .map((color) => color.label)
          .filter((label) => label.toLowerCase() !== actualLabel.toLowerCase());
        return options[Math.floor(Math.random() * options.length)];
      }

      function pickBackgroundColor() {
        return backgroundColors[Math.floor(Math.random() * backgroundColors.length)];
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
          challenge.colorTarget = Math.random() < 0.5 ? "background" : "text";
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

      function applyNumberChallenge(item) {
        const base = Number(item.label);
        const ops = [
          { label: "Add", sign: "+", fn: (value, n) => value + n },
          { label: "Subtract", sign: "-", fn: (value, n) => value - n },
          { label: "Multiply by", sign: "×", fn: (value, n) => value * n, multiplier: true }
        ];
        let op = ops[Math.floor(Math.random() * ops.length)];
        const delta = op.multiplier ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
        if (op.sign === "-" && base - delta < 0) {
          op = ops[0];
        }
        let recallHint = "";
        if (op.sign === "+") {
          recallHint = `+ ${delta}`;
        } else if (op.sign === "-") {
          recallHint = `- ${delta}`;
        } else {
          recallHint = `* ${delta}`;
        }
        return {
          ...item,
          recallHint,
          answer: String(op.fn(base, delta))
        };
      }

      function applyNumberChallenges(items, options) {
        if (!options.enableMathOps) return items;
        const candidates = items
          .map((item, index) => ({ item, index }))
          .filter((entry) => entry.item.category === "numbers");
        for (let i = candidates.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const result = items.map((item) => ({ ...item }));
        let applied = 0;
        for (const entry of candidates) {
          if (applied >= 2) break;
          if (Math.random() >= options.mathChance) continue;
          result[entry.index] = applyNumberChallenge(entry.item);
          applied += 1;
        }
        return result;
      }

      function pickItems() {
        const categories = getActiveCategories(round);
        const options = getChallengeOptions(round);
        const count =
          gameMode === "practice"
            ? Number(cardCountInput.value || 4)
            : adventureState.modifiers.cardCount || 1;
        const chosen = [];
        const used = new Set();
        while (chosen.length < count) {
          const category = categories[Math.floor(Math.random() * categories.length)];
          const list = dataSets[category];
          const rawItem = list[Math.floor(Math.random() * list.length)];
          const item = typeof rawItem === "string" ? { label: rawItem } : rawItem;
          const key = `${category}-${item.label}`.toLowerCase();
          if (used.has(key)) continue;
          used.add(key);
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
          card.classList.add("card--rise");
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

      function animateSwap(firstIndex, secondIndex, duration = swapAnimationDuration) {
        const cards = Array.from(cardGrid.children);
        const first = cards[firstIndex];
        const second = cards[secondIndex];
        if (!first || !second) return;
        const firstRect = first.getBoundingClientRect();
        const secondRect = second.getBoundingClientRect();
        cards.forEach((card, idx) => {
          card.style.order = idx;
        });
        first.style.order = secondIndex;
        second.style.order = firstIndex;
        cardGrid.offsetHeight;
        const firstRectAfter = first.getBoundingClientRect();
        const secondRectAfter = second.getBoundingClientRect();
        const dx1 = firstRect.left - firstRectAfter.left;
        const dy1 = firstRect.top - firstRectAfter.top;
        const dx2 = secondRect.left - secondRectAfter.left;
        const dy2 = secondRect.top - secondRectAfter.top;
        const arc = Math.max(18, Math.min(48, Math.abs(dx1) * 0.35));
        first.style.setProperty("--swap-x", `${dx1}px`);
        first.style.setProperty("--swap-y", `${dy1}px`);
        first.style.setProperty("--swap-arc", `${arc}px`);
        first.style.setProperty("--swap-duration", `${duration}ms`);
        second.style.setProperty("--swap-x", `${dx2}px`);
        second.style.setProperty("--swap-y", `${dy2}px`);
        second.style.setProperty("--swap-arc", `${arc}px`);
        second.style.setProperty("--swap-duration", `${duration}ms`);
        first.classList.add("swap-arc-up");
        second.classList.add("swap-arc-down");
        setTimeout(() => {
          first.classList.remove("swap-arc-up");
          second.classList.remove("swap-arc-down");
          first.style.removeProperty("--swap-x");
          first.style.removeProperty("--swap-y");
          first.style.removeProperty("--swap-arc");
          first.style.removeProperty("--swap-duration");
          second.style.removeProperty("--swap-x");
          second.style.removeProperty("--swap-y");
          second.style.removeProperty("--swap-arc");
          second.style.removeProperty("--swap-duration");
        }, duration + 50);
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

      function resetPlatformer() {
        platformerState.completed = false;
        platformerState.failed = false;
        platformerState.player = { x: 20, y: 0, w: 16, h: 20, vx: 0, vy: 0 };
        platformerState.keys = { left: false, right: false, jump: false };
        const layout = generatePlatforms();
        platformerState.platforms = layout.platforms;
        platformerState.pits = layout.pits;
        const groundY = platformerCanvas.height - 20;
        platformerState.player.y = groundY - platformerState.player.h;
        platformerState.start = { x: platformerState.player.x, y: platformerState.player.y };
        platformerState.goal = {
          x: platformerCanvas.width - 28,
          y: groundY - 20,
          w: 12,
          h: 20
        };
      }

      function generatePlatforms() {
        const platforms = [];
        const pits = [];
        const groundY = platformerCanvas.height - 20;
        const pitCount = 1 + Math.floor(Math.random() * 2);
        let attempts = 0;
        while (pits.length < pitCount && attempts < 30) {
          attempts += 1;
          const width = 30 + Math.floor(Math.random() * 30);
          const x = 120 + Math.floor(Math.random() * (platformerCanvas.width - 220));
          const nextPit = { x, y: groundY, w: width, h: 20 };
          const overlaps = pits.some((pit) => {
            const padding = 24;
            return (
              nextPit.x < pit.x + pit.w + padding &&
              nextPit.x + nextPit.w + padding > pit.x
            );
          });
          if (!overlaps) {
            pits.push(nextPit);
          }
        }
        pits.sort((a, b) => a.x - b.x);
        let cursor = 0;
        pits.forEach((pit) => {
          if (pit.x > cursor) {
            platforms.push({ x: cursor, y: groundY, w: pit.x - cursor, h: 20, isGround: true });
          }
          cursor = pit.x + pit.w;
        });
        if (cursor < platformerCanvas.width) {
          platforms.push({
            x: cursor,
            y: groundY,
            w: platformerCanvas.width - cursor,
            h: 20,
            isGround: true
          });
        }
        let x = 80;
        const stepCount = 4 + Math.floor(Math.random() * 2);
        for (let i = 0; i < stepCount; i += 1) {
          const width = 80 + Math.floor(Math.random() * 60);
          const y = groundY - (40 + Math.floor(Math.random() * 80));
          platforms.push({ x, y, w: width, h: 10 });
          x += 120 + Math.floor(Math.random() * 80);
        }
        return { platforms, pits };
      }

      function resetPlayerToStart() {
        const player = platformerState.player;
        player.x = platformerState.start.x;
        player.y = platformerState.start.y;
        player.vx = 0;
        player.vy = 0;
      }

      function updatePlatformer() {
        if (!platformerState.enabled || platformerState.completed) return;
        const player = platformerState.player;
        const speed = 2.6;
        if (platformerState.keys.left) player.vx = -speed;
        else if (platformerState.keys.right) player.vx = speed;
        else player.vx = 0;

        const onGround = isPlayerOnGround();
        if (platformerState.keys.jump && onGround) {
          player.vy = -8.5;
        }
        platformerState.keys.jump = false;

        player.vy += 0.45;
        player.x += player.vx;
        player.y += player.vy;

        if (player.x < 0) player.x = 0;
        if (player.x + player.w > platformerCanvas.width) {
          player.x = platformerCanvas.width - player.w;
        }
        if (player.y + player.h > platformerCanvas.height) {
          resetPlayerToStart();
        }

        platformerState.platforms.forEach((platform) => {
          if (
            player.vy >= 0 &&
            player.x + player.w > platform.x &&
            player.x < platform.x + platform.w &&
            player.y + player.h >= platform.y &&
            player.y + player.h <= platform.y + platform.h + 6
          ) {
            player.y = platform.y - player.h;
            player.vy = 0;
          }
        });

        if (checkGoalHit()) {
          platformerState.completed = true;
        }
      }

      function isPlayerOnGround() {
        const player = platformerState.player;
        return platformerState.platforms.some((platform) => {
          return (
            player.x + player.w > platform.x &&
            player.x < platform.x + platform.w &&
            Math.abs(player.y + player.h - platform.y) <= 1
          );
        });
      }

      function checkGoalHit() {
        const player = platformerState.player;
        const goal = platformerState.goal;
        return (
          player.x < goal.x + goal.w &&
          player.x + player.w > goal.x &&
          player.y < goal.y + goal.h &&
          player.y + player.h > goal.y
        );
      }

      function drawPlatformer() {
        if (!platformerState.enabled) return;
        platformerCtx.clearRect(0, 0, platformerCanvas.width, platformerCanvas.height);
        platformerCtx.fillStyle = "#e5e7eb";
        platformerCtx.fillRect(0, 0, platformerCanvas.width, platformerCanvas.height);

        platformerCtx.fillStyle = "#111827";
        platformerState.platforms.forEach((platform) => {
          if (platform.isGround) {
            platformerCtx.fillRect(platform.x, platform.y, platform.w, platform.h);
          }
        });
        platformerState.platforms.forEach((platform) => {
          if (!platform.isGround) {
            platformerCtx.fillRect(platform.x, platform.y, platform.w, platform.h);
          }
        });
        platformerCtx.fillStyle = "#e5e7eb";
        platformerState.pits.forEach((pit) => {
          platformerCtx.fillRect(pit.x, pit.y, pit.w, pit.h);
        });

        platformerCtx.fillStyle = "#34d399";
        const goal = platformerState.goal;
        platformerCtx.fillRect(goal.x, goal.y, goal.w, goal.h);

        platformerCtx.fillStyle = "#ffffff";
        const player = platformerState.player;
        platformerCtx.fillRect(player.x, player.y, player.w, player.h);
      }

      function updatePlatformerVisibility(active) {
        platformerState.enabled = active;
        if (active) {
          document.body.classList.add("platformer-active");
          resetPlatformer();
        } else {
          document.body.classList.remove("platformer-active");
        }
      }

      function platformerLoop() {
        if (platformerState.enabled && phase === "show" && !pauseModal.classList.contains("show")) {
          updatePlatformer();
          drawPlatformer();
        }
        requestAnimationFrame(platformerLoop);
      }

      function focusFirstInput() {
        const firstInput = inputGrid.querySelector("input");
        if (firstInput) {
          firstInput.focus();
        }
      }

      function setTimer(seconds, label, onComplete, totalSeconds = seconds) {
        clearInterval(timerId);
        const endTime = performance.now() + seconds * 1000;
        timerState = { endTime, seconds, totalSeconds, label, onComplete };
        function tick() {
          const remaining = Math.max(0, timerState.endTime - performance.now());
          const display = `${Math.ceil(remaining / 1000)}s`;
          timerPill.textContent = label ? `${label}: ${display}` : display;
          if (timerFill) {
            const progress = totalSeconds ? remaining / (totalSeconds * 1000) : 0;
            timerFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
          }
          if (remaining <= 0) {
            clearInterval(timerId);
            timerId = null;
            timerState = null;
            onComplete();
          }
        }
        tick();
        timerId = setInterval(tick, 100);
      }

      function setModalState(modal, open) {
        if (!modal) return;
        if (open) {
          modal.classList.add("show");
          modal.removeAttribute("aria-hidden");
          modal.removeAttribute("inert");
        } else {
          if (document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
          }
          modal.classList.remove("show");
          modal.setAttribute("aria-hidden", "true");
          modal.setAttribute("inert", "");
        }
      }

      function openPauseModal() {
        if (phase === "idle" || phase === "draft") return;
        pausedState = {
          phase,
          phaseText: phasePill.textContent,
          timer: null,
          adWasActive: false,
          fogWasActive: false,
          adSnapshot: null,
          glitchWasActive: false
        };
        if (timerState) {
          const remainingMs = Math.max(0, timerState.endTime - performance.now());
          pausedState.timer = {
            remainingMs,
            label: timerState.label,
            onComplete: timerState.onComplete,
            totalSeconds: timerState.totalSeconds
          };
        }
        if (adActive) {
          pausedState.adWasActive = true;
          pausedState.adSnapshot = adSnapshot ? { ...adSnapshot } : null;
          setAdInteractive(false);
        }
        if (fogActive) {
          pausedState.fogWasActive = true;
          stopFog();
        }
        if (phase === "show" && getChallengeOptions(round).enableGlitch) {
          pausedState.glitchWasActive = true;
          stopGlitching();
        }
        clearAdTimer();
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
        timerState = null;
        setModalState(pauseModal, true);
        document.body.classList.add("pause-active");
      }

      function closePauseModal() {
        setModalState(pauseModal, false);
        document.body.classList.remove("pause-active");
        setAdInteractive(true);
      }

      function restorePausedEffects(remainingSeconds) {
        if (!pausedState || phase !== "show") return;
        if (pausedState.adWasActive) {
          if (pausedState.adSnapshot) {
            adSnapshot = { ...pausedState.adSnapshot };
          }
          setAdInteractive(true);
          if (!adActive) {
            showAd({ reuseSnapshot: true });
          }
        } else if (adEnabled && !adShownThisRound && typeof remainingSeconds === "number") {
          scheduleAd(Math.max(0.1, remainingSeconds));
        }
        if (pausedState.fogWasActive) {
          startFog();
        }
        if (pausedState.glitchWasActive) {
          startGlitching();
        }
      }

      function buildExpectedLabel(item) {
        if (item.category === "numbers" && item.recallHint) {
          return {
            label: item.recallHint,
            answer: item.answer
          };
        }
        if (item.category === "colors") {
          const target = item.recallHint || "Color";
          return {
            label: target,
            answer: item.answer
          };
        }
        if (item.recallHint) {
          return {
            label: item.recallHint,
            answer: item.answer ?? item.label
          };
        }
        return {
          label: "Answer",
          answer: item.answer ?? item.label
        };
      }

      function showResults(entries, allCorrect) {
        resultsPanel.innerHTML = `
          <strong>${allCorrect ? "Perfect recall!" : "Not quite."}</strong>
          <ul>
            ${entries
              .map(
                (entry, idx) => `
                  <li>
                    <span class="result-expected">
                      <span class="result-label">Card ${idx + 1} · ${entry.expected.label}</span>
                      <span class="result-answer">${entry.expected.answer}</span>
                    </span>
                    <span class="badge ${entry.correct ? "good" : "bad"}">
                      ${entry.correct ? "Correct" : `You: ${entry.actual || "-"}`}
                    </span>
                  </li>`
              )
              .join("")}
          </ul>
        `;
        resultsPanel.classList.add("show");
      }

      function showFailure(reason) {
        const entries = roundItems.map((item) => ({
          expected: buildExpectedLabel(item),
          actual: "",
          correct: false
        }));
        resultsPanel.innerHTML = `
          <strong>${reason}</strong>
          <ul>
            ${entries
              .map(
                (entry, idx) => `
                  <li>
                    <span class="result-expected">
                      <span class="result-label">Card ${idx + 1} · ${entry.expected.label}</span>
                      <span class="result-answer">${entry.expected.answer}</span>
                    </span>
                    <span class="badge bad">You: -</span>
                  </li>`
              )
              .join("")}
          </ul>
        `;
        resultsPanel.classList.add("show");
      }

      function lockInputs(locked) {
        inputGrid.querySelectorAll("input").forEach((input) => {
          input.disabled = locked;
        });
      }

      function checkAnswers() {
        if (phase !== "recall") return;
        clearInterval(timerId);
        timerId = null;
        const platformerRequired = platformerState.required;
        const entries = roundItems.map((item, index) => {
          const mappedIndex = swapMap ? swapMap[index] : index;
          const expectedItem = roundItems[mappedIndex];
          const input = inputGrid.querySelector(`input[data-index="${index}"]`);
          const actual = input ? normalize(input.value) : "";
          return {
            expected: buildExpectedLabel(expectedItem),
            actual,
            correct: isCorrectAnswer(expectedItem, actual)
          };
        });
        const allCorrect =
          (!platformerRequired || (platformerState.completed && !platformerState.failed)) &&
          entries.every((entry) => entry.correct);
        updatePlatformerVisibility(false);
        if (allCorrect) {
          if (gameMode === "adventure") {
            adventureState.score += 10 + adventureState.difficulty;
            updateScore();
            openDraft();
            return;
          }
          streak += 1;
          updateScore();
          startRound();
          return;
        }
        lockInputs(true);
        renderCards(true);
        showResults(entries, allCorrect);
        if (submitBtn) {
          submitBtn.disabled = true;
        }
        if (nextBtn) {
          nextBtn.disabled = false;
        }
        if (gameMode === "adventure") {
          adventureState.lives = Math.max(0, adventureState.lives - 1);
        } else {
          if (nextBtn) {
            nextBtn.textContent = "Next round";
          }
          streak = 0;
        }
        setPhase("Round complete", "result");
        updateScore();
      }

      function beginRecallPhase() {
        if (phase !== "show") return;
        clearInterval(timerId);
        timerId = null;
        clearAdTimer();
        if (adEnabled && !adShownThisRound) {
          pendingSkipAfterAd = true;
          showAd();
          return;
        }
        hideAd();
        stopFog();
        stopGlitching();
        if (platformerState.required && !platformerState.completed) {
          platformerState.failed = true;
          lockInputs(true);
          renderCards(true);
          showFailure("Platformer failed");
          if (submitBtn) {
            submitBtn.disabled = true;
          }
          if (gameMode === "adventure") {
            adventureState.lives = Math.max(0, adventureState.lives - 1);
          } else {
            streak = 0;
          }
          setPhase("Round complete", "result");
          updateScore();
          updatePlatformerVisibility(false);
          return;
        }
        updatePlatformerVisibility(false);
        swapActive = false;
        swapPair = null;
        swapMap = null;
        if (swapEnabled && roundItems.length > 1) {
          swapPair = pickSwapPair(roundItems.length);
          if (swapPair) {
            swapMap = roundItems.map((_, idx) => idx);
            swapMap[swapPair[0]] = swapPair[1];
            swapMap[swapPair[1]] = swapPair[0];
            swapActive = true;
          }
        }
        timerPill.textContent = "Swapping...";
        if (timerFill) {
          timerFill.style.width = "100%";
        }
        renderCards(false);
        if (swapActive) {
          setPhase("Swapping...", "recall");
        }
        const startRecall = () => {
          lockInputs(false);
          if (submitBtn) {
            submitBtn.disabled = false;
          }
          setPhase("Type what you saw", "recall");
          focusFirstInput();
          setTimer(Number(recallInput.value), "Recall", () => {
            checkAnswers();
          });
        };
        renderInputs();
        lockInputs(true);
        if (swapActive && swapPair) {
          animateSwap(swapPair[0], swapPair[1]);
          setTimeout(() => {
            startRecall();
          }, swapAnimationDuration + 200);
          return;
        }
        startRecall();
      }

      function startRound(options = {}) {
        const { reuseItems = false, advanceRound = true } = options;
        const nextRound = advanceRound ? round + 1 : round;
        const categories = getActiveCategories(nextRound);
        if (!categories.length) {
          setPhase("Select at least one card type", "idle");
          return;
        }
        if (advanceRound) {
          round += 1;
        }
        updateScore();
        resetBoard();
        if (!reuseItems) {
          roundItems = pickItems();
          roundItemsBase = roundItems.map((item) => ({ ...item }));
        } else {
          roundItems = roundItemsBase.map((item) => ({ ...item }));
        }
        renderCards(true);
        renderInputs();
        lockInputs(true);
        if (submitBtn) {
          submitBtn.disabled = true;
        }
        if (nextBtn) {
          nextBtn.disabled = true;
        }
        resultsPanel.classList.remove("show");
        setPhase("Memorize the cards", "show");
        platformerState.required = isPlatformerEnabled();
        adEnabled = isAdEnabled();
        fogEnabled = isFogEnabled();
        swapEnabled = isSwapEnabled();
        adShownThisRound = false;
        pendingSkipAfterAd = false;
        swapActive = false;
        swapPair = null;
        swapMap = null;
        adSnapshot = null;
        hideAd();
        adActive = false;
        updatePlatformerVisibility(platformerState.required);
        startGlitching();
        if (fogEnabled) {
          startFog();
        } else {
          stopFog();
        }
        const revealSeconds = getRevealSeconds();
        scheduleAd(revealSeconds);
        setTimer(revealSeconds, "Reveal", () => {
          beginRecallPhase();
        });
      }

      function initAdventure() {
        adventureState.lives = 3;
        adventureState.score = 0;
        adventureState.difficulty = 0;
        adventureState.modifiers = {
          revealPenalty: 0,
          cardCount: 1,
          fog: false,
          swapCards: false
        };
        adventureState.unlockedCategories = ["numbers"];
      }

      function getRevealSeconds() {
        const base = Number(revealInput.value) || 5;
        if (gameMode !== "adventure") {
          return base;
        }
        const penalty = adventureState.modifiers.revealPenalty || 0;
        return Math.max(1, base - penalty);
      }

      const modifierPool = [
        {
          id: "unlockLetters",
          title: "Unlock Letters",
          description: "Add letters to the card pool.",
          difficulty: 2,
          apply: () => {
            if (!adventureState.unlockedCategories.includes("letters")) {
              adventureState.unlockedCategories.push("letters");
            }
          }
        },
        {
          id: "unlockDirections",
          title: "Unlock Directions",
          description: "Add arrow directions to the card pool.",
          difficulty: 2,
          apply: () => {
            if (!adventureState.unlockedCategories.includes("directions")) {
              adventureState.unlockedCategories.push("directions");
            }
          }
        },
        {
          id: "unlockColors",
          title: "Unlock Colors",
          description: "Add colors to the card pool.",
          difficulty: 2,
          apply: () => {
            if (!adventureState.unlockedCategories.includes("colors")) {
              adventureState.unlockedCategories.push("colors");
            }
          }
        },
        {
          id: "mathOps",
          title: "Math Ops",
          description: "Numbers may require +, -, or ×.",
          difficulty: 3,
          apply: () => {
            adventureState.modifiers.mathOps = true;
          }
        },
        {
          id: "shortReveal",
          title: "Shorter Reveal",
          description: "-1s on reveal time (stacks).",
          difficulty: 2,
          apply: () => {
            adventureState.modifiers.revealPenalty = (adventureState.modifiers.revealPenalty || 0) + 1;
          }
        },
        {
          id: "moreCards",
          title: "Add a Card",
          description: "+1 card per round (stacks, max 10).",
          difficulty: 3,
          apply: () => {
            adventureState.modifiers.cardCount = Math.min(
              10,
              (adventureState.modifiers.cardCount || 1) + 1
            );
          }
        },
        {
          id: "backgroundColor",
          title: "Background Color Challenge",
          description: "Some cards ask for the background color.",
          difficulty: 2,
          apply: () => {
            adventureState.modifiers.backgroundColor = true;
          }
        },
        {
          id: "platformer",
          title: "Platformer Recall",
          description: "Complete a mini platformer during reveal.",
          difficulty: 3,
          apply: () => {
            adventureState.modifiers.platformer = true;
          }
        },
        {
          id: "glitch",
          title: "Glitching Reveal",
          description: "Cards flicker and black out during reveal.",
          difficulty: 2,
          apply: () => {
            adventureState.modifiers.glitch = true;
          }
        },
        {
          id: "fog",
          title: "Fog Reveal",
          description: "Clear fog by moving the cursor quickly.",
          difficulty: 2,
          apply: () => {
            adventureState.modifiers.fog = true;
          }
        },
        {
          id: "swapCards",
          title: "Card Swap",
          description: "Two cards swap positions at recall.",
          difficulty: 2,
          apply: () => {
            adventureState.modifiers.swapCards = true;
          }
        },
        {
          id: "ads",
          title: "Pop-up Ads",
          description: "Random ads block cards during reveal.",
          difficulty: 2,
          apply: () => {
            adventureState.modifiers.ads = true;
          }
        },
        {
          id: "misleadColors",
          title: "Misleading Colors",
          description: "Color text can be wrong. Trust the background.",
          difficulty: 3,
          apply: () => {
            adventureState.modifiers.misleadColors = true;
          }
        },
        {
          id: "bonusLife",
          title: "Bonus Life",
          description: "Gain an extra life.",
          difficulty: 1,
          apply: () => {
            adventureState.lives += 1;
          }
        }
      ];

      function getAvailableModifiers() {
        return modifierPool.filter((modifier) => {
          if (modifier.id === "unlockLetters") {
            return !adventureState.unlockedCategories.includes("letters");
          }
          if (modifier.id === "unlockDirections") {
            return !adventureState.unlockedCategories.includes("directions");
          }
          if (modifier.id === "unlockColors") {
            return !adventureState.unlockedCategories.includes("colors");
          }
          if (modifier.id === "mathOps") {
            return !adventureState.modifiers.mathOps;
          }
          if (modifier.id === "shortReveal") {
            return (adventureState.modifiers.revealPenalty || 0) < 3;
          }
          if (modifier.id === "backgroundColor") {
            return !adventureState.modifiers.backgroundColor;
          }
          if (modifier.id === "platformer") {
            return !adventureState.modifiers.platformer;
          }
          if (modifier.id === "glitch") {
            return !adventureState.modifiers.glitch;
          }
          if (modifier.id === "fog") {
            return !adventureState.modifiers.fog;
          }
          if (modifier.id === "swapCards") {
            return !adventureState.modifiers.swapCards;
          }
          if (modifier.id === "ads") {
            return !adventureState.modifiers.ads;
          }
          if (modifier.id === "moreCards") {
            return (adventureState.modifiers.cardCount || 1) < 10;
          }
          if (modifier.id === "misleadColors") {
            return (
              adventureState.unlockedCategories.includes("colors") &&
              !adventureState.modifiers.misleadColors
            );
          }
          if (modifier.id === "bonusLife") {
            return true;
          }
          return true;
        });
      }

      function openDraft() {
        if (gameMode !== "adventure") return;
        if (submitBtn) {
          submitBtn.disabled = true;
        }
        if (nextBtn) {
          nextBtn.disabled = true;
        }
        setPhase("Choose a modifier", "draft");
        renderDraftChoices();
      }

      function renderDraftChoices() {
        draftGrid.innerHTML = "";
        const pool = getAvailableModifiers();
        for (let i = pool.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const choices = pool.slice(0, 3);
        choices.forEach((modifier) => {
          const card = document.createElement("button");
          card.className = "draft-card";
          card.type = "button";
          card.innerHTML = `
            <small>Difficulty +${modifier.difficulty}</small>
            <strong>${modifier.title}</strong>
            <span>${modifier.description}</span>
          `;
          card.addEventListener("click", () => {
            modifier.apply();
            adventureState.difficulty += modifier.difficulty;
            updateScore();
            startRound({ reuseItems: false, advanceRound: true });
          });
          draftGrid.appendChild(card);
        });
      }

      function resetGame() {
        clearInterval(timerId);
        timerId = null;
        pausedState = null;
        timerState = null;
        updatePlatformerVisibility(false);
        stopFog();
        stopGlitching();
        clearAdTimer();
        hideAd();
        round = 0;
        streak = 0;
        if (gameMode === "adventure") {
          initAdventure();
        }
        roundItems = [];
        roundItemsBase = [];
        updateScore();
        timerPill.textContent = "00";
        if (timerFill) {
          timerFill.style.width = "100%";
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

      function openPracticeModal() {
        document.querySelectorAll("#practiceModal .checkboxes input").forEach((input) => {
          input.disabled = false;
        });
        setModalState(practiceModal, true);
      }

      function closePracticeModal() {
        setModalState(practiceModal, false);
      }

      practiceStart.addEventListener("click", () => {
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

      adventureStart.addEventListener("click", () => {
        modeSelect.value = "adventure";
        updateModeUI();
        resetGame();
        startRound();
      });

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

      practiceConfirm.addEventListener("click", () => {
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

      window.addEventListener("resize", () => {
        if (!fogActive) return;
        resizeFog();
        drawFog();
      });


      window.addEventListener("keydown", (event) => {
        if (phase !== "show" || !platformerState.enabled) return;
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

      pauseResume.addEventListener("click", () => {
        closePauseModal();
        const remainingSeconds =
          pausedState && pausedState.timer ? pausedState.timer.remainingMs / 1000 : null;
        if (pausedState && pausedState.phase) {
          if (pausedState.timer && pausedState.timer.remainingMs > 0) {
            setTimer(
              pausedState.timer.remainingMs / 1000,
              pausedState.timer.label,
              pausedState.timer.onComplete,
              pausedState.timer.totalSeconds
            );
          }
        }
        restorePausedEffects(remainingSeconds);
        pausedState = null;
      });

      pauseRestart.addEventListener("click", () => {
        closePauseModal();
        resetGame();
        startRound();
      });

      pauseQuit.addEventListener("click", () => {
        closePauseModal();
        resetGame();
      });

      pauseModal.addEventListener("click", (event) => {
        if (event.target === pauseModal) {
          closePauseModal();
          const remainingSeconds =
            pausedState && pausedState.timer ? pausedState.timer.remainingMs / 1000 : null;
          if (pausedState && pausedState.phase) {
            setPhase(pausedState.phaseText, pausedState.phase);
            if (pausedState.timer && pausedState.timer.remainingMs > 0) {
              setTimer(
                pausedState.timer.remainingMs / 1000,
                pausedState.timer.label,
                pausedState.timer.onComplete
              );
            }
          }
          restorePausedEffects(remainingSeconds);
          pausedState = null;
        }
      });

      if (submitBtn) {
        submitBtn.addEventListener("click", () => {
          checkAnswers();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          if (phase === "result" && gameMode === "adventure") {
            if (adventureState.lives > 0) {
              startRound({ reuseItems: true, advanceRound: false });
            } else {
              resetGame();
            }
          } else {
            startRound();
          }
        });
      }

      modeSelect.addEventListener("change", () => {
        updateModeUI();
        resetGame();
      });

      document.addEventListener("keydown", (event) => {
        if (referenceModal && referenceModal.classList.contains("show")) {
          if (event.key === "Escape") {
            event.preventDefault();
            setModalState(referenceModal, false);
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
        if (pauseModal.classList.contains("show")) {
          if (event.key === "Enter") {
            event.preventDefault();
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          if (pauseModal.classList.contains("show")) {
            closePauseModal();
            const remainingSeconds =
              pausedState && pausedState.timer ? pausedState.timer.remainingMs / 1000 : null;
            if (pausedState && pausedState.phase) {
              if (pausedState.timer && pausedState.timer.remainingMs > 0) {
                setTimer(
                  pausedState.timer.remainingMs / 1000,
                  pausedState.timer.label,
                  pausedState.timer.onComplete,
                  pausedState.timer.totalSeconds
                );
              }
            }
            restorePausedEffects(remainingSeconds);
            pausedState = null;
          } else {
            openPauseModal();
          }
          return;
        }
        if (event.key !== "Enter") return;
        if (phase === "show") {
          skipRevealNow();
        } else if (phase === "recall") {
          checkAnswers();
        } else if (phase === "result") {
          if (gameMode === "adventure") {
            if (adventureState.lives > 0) {
              startRound({ reuseItems: false, advanceRound: true });
            } else {
              resetGame();
            }
          } else {
            startRound();
          }
        }
      });

      updateModeUI();
      resetGame();
      updateCategoryControls();
    
