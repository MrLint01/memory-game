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

      function resetGame() {
        bumpRoundFlowToken();
        if (successAnimationActive) {
          cancelSuccessAnimation();
        }
        clearFlashCountdown();
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
        const unlockKey = unlockStage && unlockStage.id ? String(unlockStage.id) : String(unlockStageIndex + 1);
        return Boolean(window.stageCompleted && window.stageCompleted[unlockKey]);
      }

      function updatePracticeLock() {
        const unlocked = isPracticeUnlocked();
        if (practiceStart) {
          practiceStart.disabled = !unlocked;
          practiceStart.classList.toggle("mode-card--locked", !unlocked);
          const lockText = practiceStart.querySelector(".mode-card__lock");
          if (lockText) {
            lockText.textContent = unlocked ? "" : "Locked • Clear Stage 5";
          }
        }
      }

      function formatStageModifiers(modifiers) {
        const entries = [
          { key: "mathOps", label: "Math ops" },
          { key: "misleadColors", label: "Misleading colors" },
          { key: "backgroundColor", label: "Background color" },
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
      let flashWarningEnabled = true;
      let tabTutorialShownRound = null;
      let tabTutorialActive = false;
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
        flashCountdownTimers.forEach((timerId) => clearTimeout(timerId));
        flashCountdownTimers = [];
        if (flashCountdown) {
          flashCountdown.classList.remove("show");
          flashCountdown.setAttribute("aria-hidden", "true");
        }
        document.body.classList.remove("flash-countdown-active");
      }

      function runFlashCountdown(onComplete) {
        if (!flashCountdownEnabled) {
          if (typeof onComplete === "function") onComplete();
          return;
        }
        if (!flashCountdown) {
          if (typeof onComplete === "function") onComplete();
          return;
        }
        clearFlashCountdown();
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
          const stageKey = stage && stage.id ? String(stage.id) : String(index + 1);
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
          const stageKey = stage && stage.id ? String(stage.id) : String(index + 1);
          const bestSeconds = Number(window.stageBestTimes && window.stageBestTimes[stageKey]);
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
          misleadColors: { label: "Mislead", src: "imgs/icons/mod-misleadcolors.svg" },
          backgroundColor: { label: "Background", src: "imgs/icons/mod-backgroundcolor.svg" },
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
        stageIntroOriginEl = originEl;
        setModalState(stageIntroModal, true);
        applyStageIntroOrigin(stageIntroOriginEl);
        return true;
      }

      function isStageUnlocked(stageIndex) {
        if (window.unlockAllStages) return true;
        if (window.lockAllStagesExceptFirst) return stageIndex === 0;
        // Stage 1 (first stage) is always unlocked
        if (stageIndex === 0) return true;
        
        // Check if previous stage has been completed
        const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
        const prevStage = stages[stageIndex - 1];
        if (!prevStage) return false;
        
        const prevStageKey = prevStage && prevStage.id ? String(prevStage.id) : String(stageIndex);
        
        // Initialize stageCompleted object if it doesn't exist
        if (!window.stageCompleted) {
          window.stageCompleted = {};
        }
        
        return window.stageCompleted[prevStageKey] === true;
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
            const stageKey = stage && stage.id ? String(stage.id) : String(index + 1);
            return sum + (window.stageStars && window.stageStars[stageKey] ? window.stageStars[stageKey] : 0);
          }, 0);
          const completedCount = stages.reduce((sum, stage, index) => {
            const stageKey = stage && stage.id ? String(stage.id) : String(index + 1);
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
            const stageKey = stage && stage.id ? String(stage.id) : String(index + 1);
            const stars = window.stageStars && window.stageStars[stageKey] ? window.stageStars[stageKey] : 0;
            const bestTimeSeconds = Number(
              window.stageBestTimes && window.stageBestTimes[stageKey]
            );
            const isCompleted = window.stageCompleted && window.stageCompleted[stageKey];
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
      }

      function closeStagesScreen(animateHome = true) {
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

      function startStage(index, options = {}) {
        const { skipIntro = false, originEl = null, deferStartRound = false } = options;
        tabTutorialShownRound = null;
        tabTutorialActive = false;
        firstLetterHintCooldown = 0;
        clearTabKeyHint();
        clearFirstLetterHint();
        clearFlashCountdown();
        const stage = window.getStageConfig ? window.getStageConfig(index) : null;
        if (!skipIntro && openStageIntro(index, originEl)) {
          return;
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
      if (stageIntroStart && stageIntroModal) {
        stageIntroStart.addEventListener("click", () => {
          const index = stageIntroPendingIndex;
          if (!Number.isFinite(index)) return;
          const stage = window.getStageConfig ? window.getStageConfig(index) : null;
          if (stage && String(stage.stageType).toLowerCase() === "flash") {
            if (flashWarningEnabled) {
              openFlashStagePrompt(index);
              return;
            }
            closeStageIntro();
            startStage(index, { skipIntro: true, deferStartRound: true });
            startFlashRound();
            return;
          }
          closeStageIntro();
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
        flashStageStart.addEventListener("click", () => {
          const index = flashStagePendingIndex;
          closeFlashStagePrompt();
          if (stageIntroModal && stageIntroModal.classList.contains("show")) {
            closeStageIntro();
          }
          if (Number.isFinite(index)) {
            startStage(index, { skipIntro: true, deferStartRound: true });
            startFlashRound();
          }
        });
      }
      if (flashStageSkip) {
        const storageKey = "flashRecallFlashWarning";
        const saved = window.localStorage.getItem(storageKey);
        if (saved !== null) {
          flashWarningEnabled = saved === "1";
          flashStageSkip.checked = saved !== "1";
        }
        flashStageSkip.addEventListener("change", () => {
          flashWarningEnabled = !flashStageSkip.checked;
          window.localStorage.setItem(storageKey, flashWarningEnabled ? "1" : "0");
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
            tabTutorialActive = true;
            tabTutorialDisabledInputs = [];
            inputGrid.querySelectorAll('input[data-index]').forEach((field) => {
              const idx = Number(field.dataset.index);
              if (Number.isFinite(idx) && idx > 0 && !field.disabled) {
                field.disabled = true;
                tabTutorialDisabledInputs.push(field);
              }
            });
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
              input.checked = true;
            });
        });
      }
      if (settingsOpen && settingsModal) {
        settingsOpen.addEventListener("click", () => {
          setModalState(settingsModal, true);
        });
      }
      if (settingsClose && settingsModal) {
        settingsClose.addEventListener("click", () => {
          setModalState(settingsModal, false);
        });
      }
      if (settingsModal) {
        settingsModal.addEventListener("click", (event) => {
          if (event.target === settingsModal) {
            setModalState(settingsModal, false);
          }
        });
      }
      const debugResetProgress = document.getElementById("debugResetProgress");
      if (debugResetProgress) {
        debugResetProgress.addEventListener("click", () => {
          window.stageStars = {};
          window.stageBestTimes = {};
          window.stageCompleted = {};
          window.stageNewSeen = {};
          window.flashRecallSessionStats = { totalSeconds: 0, totalCards: 0 };
          window.localStorage.removeItem("flashRecallStats");
          window.localStorage.removeItem("flashRecallFlashWarning");
          if (typeof window.saveStageProgress === "function") {
            window.saveStageProgress();
          }
          if (stagesScreen && document.body.dataset.view === "stages") {
            renderStageList(false);
          }
        });
      }
      if (statsOpen && statsModal) {
        statsOpen.addEventListener("click", () => {
          const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
          const stagesClearedEl = document.getElementById("statsStagesCleared");
          const stagesTotalEl = document.getElementById("statsStagesTotal");
          const starsEarnedEl = document.getElementById("statsStarsEarned");
          const avgPerCardEl = document.getElementById("statsAvgPerCard");
          const avgBestPerCardEl = document.getElementById("statsAvgBestPerCard");
          if (stagesClearedEl || stagesTotalEl || starsEarnedEl) {
            const totalStages = stages.length;
            const stagesCleared = stages.reduce((sum, stage, index) => {
              const stageKey = stage && stage.id ? String(stage.id) : String(index + 1);
              return sum + (window.stageCompleted && window.stageCompleted[stageKey] ? 1 : 0);
            }, 0);
            const starsEarned = stages.reduce((sum, stage, index) => {
              const stageKey = stage && stage.id ? String(stage.id) : String(index + 1);
              return sum + (window.stageStars && window.stageStars[stageKey] ? window.stageStars[stageKey] : 0);
            }, 0);
            if (stagesClearedEl) stagesClearedEl.textContent = String(stagesCleared);
            if (stagesTotalEl) stagesTotalEl.textContent = String(totalStages);
            if (starsEarnedEl) starsEarnedEl.textContent = String(starsEarned);
          }
          if (avgPerCardEl) {
            const key = "flashRecallStats";
            let avgText = "—";
            try {
              const raw = window.localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                const totalSeconds = Number(parsed && parsed.totalSeconds) || 0;
                const totalCards = Number(parsed && parsed.totalCards) || 0;
                if (totalCards > 0) {
                  const avg = totalSeconds / totalCards;
                  avgText = `${avg.toFixed(2)}s`;
                }
              }
            } catch (error) {
              avgText = "—";
            }
            if (avgText === "—") {
              const sessionStats = window.flashRecallSessionStats;
              const totalSeconds = Number(sessionStats && sessionStats.totalSeconds) || 0;
              const totalCards = Number(sessionStats && sessionStats.totalCards) || 0;
              if (totalCards > 0) {
                avgText = `${(totalSeconds / totalCards).toFixed(2)}s`;
              }
            }
            avgPerCardEl.textContent = avgText;
          }
          if (avgBestPerCardEl) {
            const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
            const totals = stages.reduce(
              (acc, stage, index) => {
                const stageKey = stage && stage.id ? String(stage.id) : String(index + 1);
                const bestSeconds = Number(window.stageBestTimes && window.stageBestTimes[stageKey]);
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
              avgBestPerCardEl.textContent = "—";
            }
          }
          setModalState(statsModal, true);
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
              error.hidden = true;
              error.classList.remove("show");
              error.dataset.hideTimer = "";
            }, 3000);
            error.dataset.hideTimer = String(timerId);
          }
          return;
        }
        const error = document.getElementById("practiceTypeError");
        if (error) {
          error.hidden = true;
          error.classList.remove("show");
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

      if (practiceModal) {
        practiceModal.addEventListener("change", (event) => {
          const target = event.target;
          if (!(target && target.matches("input[type=\"checkbox\"][value]"))) return;
          const error = document.getElementById("practiceTypeError");
          if (!error) return;
          const anyChecked = Array.from(
            practiceModal.querySelectorAll(".control-group .checkboxes input[type=\"checkbox\"][value]")
          ).some((input) => input.checked);
          if (anyChecked) {
            error.hidden = true;
            error.classList.remove("show");
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
            activeInput.value = "↑";
            activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          case "ArrowDown":
            event.preventDefault();
            activeInput.value = "↓";
            activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          case "ArrowLeft":
            event.preventDefault();
            activeInput.value = "←";
            activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          case "ArrowRight":
            event.preventDefault();
            activeInput.value = "→";
            activeInput.dispatchEvent(new Event('input', { bubbles: true }));
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
            if (typeof trackLevelSession === 'function') {
              trackLevelSession(stageState.index, false, 0, backElapsedSeconds, backEntries);
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
        const keyLower = event.key.toLowerCase();
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
          return;
        }
        if (phase === "result" && gameMode === "stages") {
          if (keyLower === "q") {
            event.preventDefault();
            const menuBtn =
              document.getElementById("stageMenuButton") || document.getElementById("stageBackButton");
            if (menuBtn) menuBtn.click();
            return;
          }
          if (keyLower === "h") {
            event.preventDefault();
            const homeBtn = document.getElementById("stageHomeButton");
            if (homeBtn) homeBtn.click();
            return;
          }
          if (keyLower === "n") {
            event.preventDefault();
            const nextBtn = document.getElementById("stageNextButton");
            if (nextBtn) nextBtn.click();
            return;
          }
          if (keyLower === "r") {
            event.preventDefault();
            const retryBtn = document.getElementById("stageRetryButton");
            if (retryBtn) retryBtn.click();
            return;
          }
        }
        if (phase === "result" && gameMode === "practice") {
          if (keyLower === "h") {
            event.preventDefault();
            const backBtn = document.getElementById("practiceBackButton");
            if (backBtn) backBtn.click();
            return;
          }
          if (keyLower === "r") {
            event.preventDefault();
            const retryBtn = document.getElementById("practiceRetryButton");
            if (retryBtn) retryBtn.click();
            return;
          }
          if (keyLower === "s") {
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
          checkAnswers();
        } else if (phase === "result") {
          return;
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

      updateModeUI();
      updatePracticeLock();
      resetGame();
      updateCategoryControls();

      if (successAnimationToggle) {
        const storageKey = "flashRecallSuccessAnimation";
        const saved = window.localStorage.getItem(storageKey);
        if (saved !== null) {
          successAnimationToggle.checked = saved === "1";
        }
        setSuccessAnimationEnabled(successAnimationToggle.checked);
        successAnimationToggle.addEventListener("change", () => {
          window.localStorage.setItem(storageKey, successAnimationToggle.checked ? "1" : "0");
          setSuccessAnimationEnabled(successAnimationToggle.checked);
        });
      }

      if (flashCountdownToggle) {
        const storageKey = "flashRecallFlashCountdown";
        const saved = window.localStorage.getItem(storageKey);
        if (saved !== null) {
          flashCountdownToggle.checked = saved === "1";
        }
        flashCountdownEnabled = flashCountdownToggle.checked;
        flashCountdownToggle.addEventListener("change", () => {
          flashCountdownEnabled = flashCountdownToggle.checked;
          window.localStorage.setItem(storageKey, flashCountdownToggle.checked ? "1" : "0");
        });
      }

      // Track session end on page unload
      window.addEventListener("beforeunload", () => {
        const totalSessionSeconds = (performance.now() - sessionStartTime) / 1000;
        if (typeof trackSessionEnd === 'function') {
          trackSessionEnd(totalSessionSeconds, lastCompletedLevel);
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
