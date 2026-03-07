      function setTimer(seconds, label, onComplete, totalSeconds = seconds) {
        clearInterval(timerId);
        const endTime = performance.now() + seconds * 1000;
        timerState = { endTime, seconds, totalSeconds, label, onComplete };
        function tick() {
          const remaining = Math.max(0, timerState.endTime - performance.now());
          const display = `${Math.ceil(remaining / 1000)}s`;
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

      function startStageStopwatch() {
        if (!stageTimerHud) return;
        if (stageTimerId) {
          clearInterval(stageTimerId);
        }
        stageTimerId = setInterval(() => {
          const startTime = stageState.startTime || performance.now();
          const elapsedMs = performance.now() - startTime;
          const elapsedSeconds = elapsedMs / 1000;
          stageState.elapsedSeconds = elapsedSeconds;
          stageTimerHud.textContent = `Time ${elapsedSeconds.toFixed(2)}`;
        }, 50);
      }

      function stopStageStopwatch() {
        if (stageTimerId) {
          clearInterval(stageTimerId);
          stageTimerId = null;
        }
      }

      function setModalState(modal, open) {
        if (!modal) return;
        if (open) {
          modal.removeAttribute("aria-hidden");
          modal.removeAttribute("inert");
          modal.removeAttribute("hidden");
          if (modal.__closeTimer) {
            clearTimeout(modal.__closeTimer);
            modal.__closeTimer = null;
          }
          if (modal.dataset.closing === "true") {
            delete modal.dataset.closing;
          }
          if (modal.classList.contains("closing")) {
            modal.classList.remove("closing");
          }
          if (!modal.classList.contains("show")) {
            // Ensure transitions fire after un-hiding.
            modal.classList.remove("show");
            void modal.offsetWidth;
            modal.classList.add("show");
          }
        } else {
          if (document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
          }
          modal.setAttribute("aria-hidden", "true");
          modal.setAttribute("inert", "");
          if (modal.hasAttribute("hidden") || modal.dataset.closing === "true") {
            return;
          }
          modal.dataset.closing = "true";
          modal.classList.add("closing");
          const finishClose = () => {
            if (modal.dataset.closing !== "true") return;
            delete modal.dataset.closing;
            modal.classList.remove("closing");
            modal.classList.remove("show");
            modal.setAttribute("hidden", "");
            modal.removeEventListener("transitionend", onCloseEnd);
            if (modal.__closeTimer) {
              clearTimeout(modal.__closeTimer);
              modal.__closeTimer = null;
            }
          };
          const onCloseEnd = (event) => {
            if (event.target !== modal) return;
            finishClose();
          };
          modal.addEventListener("transitionend", onCloseEnd);
          modal.__closeTimer = setTimeout(finishClose, 260);
        }
      }

      function openPauseModal() {
        if (phase === "idle") {
          return;
        }
        pausedState = {
          phase,
          phaseText: phase,
          timer: null,
          adWasActive: false,
          fogWasActive: false,
          blurWasActive: false,
          adSnapshot: null,
          glitchWasActive: false,
          swapRemaining: null,
          stagePauseStart: null
        };
        if (gameMode === "stages" && stageState.active) {
          pausedState.stagePauseStart = performance.now();
          stopStageStopwatch();
        }
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
        if (blurActive) {
          pausedState.blurWasActive = true;
          stopBlur();
        }
        if (phase === "show" && getChallengeOptions(round).enableGlitch) {
          pausedState.glitchWasActive = true;
          stopGlitching();
        }
        if (swapTimeoutId && swapStartTime) {
          const elapsed = performance.now() - swapStartTime;
          swapRemaining = Math.max(0, (swapRemaining ?? 0) - elapsed);
          pausedState.swapRemaining = swapRemaining;
          clearTimeout(swapTimeoutId);
          swapTimeoutId = null;
          swapStartTime = null;
        }
        if (successAnimationActive) {
          pauseSuccessAnimation();
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

      function resumeFromPause() {
        if (!pausedState || !pausedState.phase) return;
        if (pausedState.stagePauseStart && typeof stageState.startTime === "number") {
          const pauseDuration = performance.now() - pausedState.stagePauseStart;
          stageState.startTime += pauseDuration;
        }
        const remainingSeconds =
          pausedState.timer && pausedState.timer.remainingMs > 0
            ? pausedState.timer.remainingMs / 1000
            : null;
        if (pausedState.phase === "show") {
          setPhase(pausedState.phaseText, pausedState.phase);
        } else if (pausedState.phase === "recall") {
          if (pausedState.swapRemaining && swapStartRecall) {
            setPhase("Swapping...", "recall");
          } else {
            setPhase("Type what you saw", "recall");
          }
        }
        if (remainingSeconds !== null && !(pausedState.swapRemaining && swapStartRecall)) {
          setTimer(
            remainingSeconds,
            pausedState.timer.label,
            pausedState.timer.onComplete,
            pausedState.timer.totalSeconds
          );
        } else if (
          pausedState.phase === "recall" &&
          !swapTimeoutId &&
          !(pausedState.swapRemaining && swapStartRecall)
        ) {
          setTimer(getRecallSeconds(), "Recall", () => {
            checkAnswers();
          });
        }
        restorePausedEffects(remainingSeconds);
        if (gameMode === "stages" && stageState.active) {
          if (successAnimationActive) {
            resumeSuccessAnimation();
          } else {
            startStageStopwatch();
          }
        }
        pausedState = null;
      }

      function restorePausedEffects(remainingSeconds) {
        if (!pausedState) return;
        if (phase === "show") {
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
          if (pausedState.blurWasActive) {
            startBlur();
          }
          if (pausedState.glitchWasActive) {
            startGlitching();
          }
        }
        if (pausedState.swapRemaining && swapStartRecall) {
          const resumeRecall = swapStartRecall;
          swapRemaining = pausedState.swapRemaining;
          swapStartTime = performance.now();
          swapTimeoutId = setTimeout(() => {
            swapTimeoutId = null;
            swapStartTime = null;
            swapRemaining = null;
            swapStartRecall = null;
            if (swapCleanup) {
              swapCleanup();
              swapCleanup = null;
            }
            resumeRecall();
          }, swapRemaining);
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
          label: formatCategoryLabel(item.category),
          answer: item.answer ?? item.label
        };
      }

      function showReviewFailure(entries, mode, swapOrder = null) {
        if (typeof window.clearTabKeyHint === "function") {
          window.clearTabKeyHint();
        }
        if (typeof window.clearFirstLetterHint === "function") {
          window.clearFirstLetterHint();
        }
        if (window.tabTutorialActive) { 
          tabTutorialActive = false;
          if (tabTutorialDisabledInputs.length) {
            tabTutorialDisabledInputs.forEach((field) => {
              field.disabled = false;
            });
            tabTutorialDisabledInputs = [];
          }
        }
        stopFog();
        stopBlur();
        stopGlitching();
        document.body.classList.add("stage-fail");
        const originalItems = roundItems;
        const useSwapOrder =
          Array.isArray(swapOrder) && swapOrder.length === roundItems.length && swapOrder.every(Number.isInteger);
        if (useSwapOrder) {
          roundItems = swapOrder.map((idx) => originalItems[idx]);
        }
        renderCards(true);
        if (promptGrid) {
          promptGrid.innerHTML = "";
          entries.forEach((entry) => {
            const prompt = document.createElement("div");
            prompt.className = "card hidden-card hint";
            const hintHtml = String(entry.expected.label || "")
              .replace(/↻/g, '<span class="rotation-icon">↻</span>')
              .replace(/↺/g, '<span class="rotation-icon">↺</span>');
            prompt.innerHTML = `
              <small>Card ${entry.displayIndex}</small>
              <span>${hintHtml}</span>
            `;
            promptGrid.appendChild(prompt);
          });
        }
        renderInputs();
        roundItems = originalItems;
        inputGrid.querySelectorAll("input").forEach((input) => {
          const index = Number(input.dataset.index);
          const entry = entries[index];
          if (!entry) return;
          const displayValue =
            Object.prototype.hasOwnProperty.call(entry, "raw") && entry.raw !== "" ? entry.raw : entry.actual;
          const baseValue = displayValue ? displayValue : "—";
          input.value = baseValue;
          input.disabled = true;
          input.classList.toggle("answer-correct", entry.correct);
          input.classList.toggle("answer-wrong", !entry.correct);
          const wrapper = input.parentElement;
          if (wrapper && !entry.correct) {
            wrapper.classList.add("has-correct-inline");
            const correct = document.createElement("span");
            correct.className = "input-correct-inline";
            correct.textContent = `Correct: ${entry.expected.answer}`;
            wrapper.appendChild(correct);
          }
        });
        const stageNumber = Number.isFinite(stageState.index) ? stageState.index + 1 : 1;
        const retryActionKey =
          typeof window.getActionKeyLabel === "function" ? window.getActionKeyLabel("retry") : "R";
        const retryKey = retryActionKey;
        const menuKey =
          typeof window.getActionKeyLabel === "function" ? window.getActionKeyLabel("stageQuit") : "Q";
        const practiceHomeKey =
          typeof window.getActionKeyLabel === "function" ? window.getActionKeyLabel("practiceHome") : "H";
        const practiceSettingsKey =
          typeof window.getActionKeyLabel === "function" ? window.getActionKeyLabel("practiceSettings") : "S";
        const title = mode === "stages" ? `Stage ${stageNumber} Failed` : "Round Failed";
        const subtitle = mode === "stages" ? "" : `Streak ${streak}`;
        const buttons =
          mode === "stages"
            ? `<button id="stageMenuButton" class="secondary icon-button" type="button" aria-label="Menu (${menuKey})">
                 <img class="action-icon" src="imgs/menu_button.png" alt="" />
                 <span class="action-key-hint" aria-hidden="true">(${menuKey})</span>
               </button>
               <button id="stageRetryButton" class="secondary icon-button button-entice" type="button" aria-label="Retry (${retryKey})">
                 <img class="action-icon" src="imgs/retry_button.png" alt="" />
                 <span class="action-countdown" aria-live="polite"></span>
                 <span class="action-key-hint" aria-hidden="true">(${retryKey})</span>
               </button>`
            : `<button id="practiceSettingsButton" class="secondary icon-button" type="button" aria-label="Sandbox settings">
                 <img class="action-icon" src="imgs/settings_button.png" alt="" />
                 <span class="action-key-hint" aria-hidden="true">(${practiceSettingsKey})</span>
               </button>
               <button id="practiceBackButton" class="secondary icon-button" type="button" aria-label="Home (${practiceHomeKey})">
                 <img class="action-icon" src="imgs/home_button.png" alt="" />
                 <span class="action-key-hint" aria-hidden="true">(${practiceHomeKey})</span>
               </button>
               <button id="practiceRetryButton" class="secondary icon-button" type="button" aria-label="Restart (${retryKey})">
                 <img class="action-icon" src="imgs/retry_button.png" alt="" />
                 <span class="action-key-hint" aria-hidden="true">(${retryKey})</span>
               </button>`;
        const actions = document.querySelector(".stage .actions");
        if (actions) {
          actions.innerHTML = `<div class="stage-fail-actions">${buttons}</div>`;
        }
        resultsPanel.innerHTML = `
          <div class="stage-fail-bar">
            <div class="stage-fail-bar__text">
              <strong>${title}</strong>
              ${subtitle ? `<div class="stage-meta">${subtitle}</div>` : ""}
            </div>
          </div>
        `;
        resultsPanel.classList.add("show");
      }

      function getStageStars(elapsedSeconds, stage) {
        const targets = window.getStageStarTargets ? window.getStageStarTargets(stage) : null;
        if (!targets) return 0;
        if (Number.isFinite(targets.platinum) && elapsedSeconds <= targets.platinum) return 4;
        if (elapsedSeconds <= targets.gold) return 3;
        if (elapsedSeconds <= targets.silver) return 2;
        if (elapsedSeconds <= targets.bronze) return 1;
        return 0;
      }

      function saveStageStars(stage, stars, elapsedSeconds) {
        if (!stage || !window.stageStars) return { hadBest: false };
        const key = window.getStageStarsKey
          ? window.getStageStarsKey(stage, stageState.index)
          : (stage.id ? String(stage.id) : String(stageState.index + 1));
        let hadBest = false;
        
        // Save stars (keep the highest)
        const hasEntry = Object.prototype.hasOwnProperty.call(window.stageStars, key);
        const current = hasEntry ? Number(window.stageStars[key]) : null;
        if (!hasEntry || stars > current) {
          window.stageStars[key] = stars;
        }
        
        // Mark as completed (regardless of stars)
        if (!window.stageCompleted) {
          window.stageCompleted = {};
        }
        window.stageCompleted[key] = true;

        // Call the global save function if it exists
        if (window.saveStageProgress) {
          window.saveStageProgress();
        }

        if (Number.isFinite(elapsedSeconds)) {
          if (!window.stageBestTimes) {
            window.stageBestTimes = {};
          }
          const bestKey = window.getStageBestTimeKey
            ? window.getStageBestTimeKey(stage, stageState.index)
            : key;
          const currentBest = Number(window.stageBestTimes[bestKey]);
          hadBest = Number.isFinite(currentBest);
          if (!Number.isFinite(currentBest) || elapsedSeconds < currentBest) {
            window.stageBestTimes[bestKey] = elapsedSeconds;
          }
          if (window.saveStageProgress) {
            window.saveStageProgress();
          }
        }
        return { hadBest };
      }

      function showStageComplete(elapsedSeconds, stars, stage, options = {}) {
        if (typeof window.clearTabKeyHint === "function") {
          window.clearTabKeyHint();
        }
        if (typeof window.clearFirstLetterHint === "function") {
          window.clearFirstLetterHint();
        }
        stopFog();
        stopBlur();
        stopGlitching();
        stopStageStopwatch();
        document.body.classList.remove("stage-fail");
        cardGrid.innerHTML = "";
        inputGrid.innerHTML = "";
        const actions = document.querySelector(".stage .actions");
        if (actions) {
          actions.innerHTML = "";
        }
        const stageName = stage && stage.name ? stage.name : `Stage ${stageState.index + 1}`;
        const stageId = stage && stage.id ? String(stage.id) : String(stageState.index + 1);
        const stageVersion = window.getStageVersion ? window.getStageVersion(stage) : 1;
        // Get star times from stages-data
        const starTimes = stage && stage.starTimes ? stage.starTimes : {};
        bronzeTime = starTimes.bronze || null;
        silverTime = starTimes.silver || null;
        goldTime = starTimes.gold || null;
        platinumTime = starTimes.platinum || null;

        bronzeLabel = bronzeTime ? `<div class="star-time bronze">${bronzeTime}s</div>` : "";
        silverLabel = silverTime ? `<div class="star-time silver">${silverTime}s</div>` : "";
        goldLabel = goldTime ? `<div class="star-time gold">${goldTime}s</div>` : "";
        platinumLabel = platinumTime ? `<div class="star-time platinum">${platinumTime}s</div>` : "";

        const retryActionKey =
          typeof window.getActionKeyLabel === "function" ? window.getActionKeyLabel("retry") : "R";
        const stageQuitKey =
          typeof window.getActionKeyLabel === "function" ? window.getActionKeyLabel("stageQuit") : "Q";
        const stageNextKey =
          typeof window.getActionKeyLabel === "function" ? window.getActionKeyLabel("stageNext") : "N";
        const retryKey = retryActionKey;
        const starGap = stars < 4 ? "1rem" : "0.65rem";

        resultsPanel.innerHTML = `
          <div class="stage-complete">
            <div class="stage-complete__left-column">
              <div class="stage-complete__header">
                <strong>${stageName} complete!</strong>
                <div class="stage-meta">Time: ${elapsedSeconds.toFixed(2)}s <span class="stage-meta--best" id="stageCompleteBestTime"></span></div>
                <div
                  class="stage-competitive-message"
                  id="stageCompetitiveMessage"
                  data-stage-id="${stageId}"
                  data-stage-version="${stageVersion}"
                >
                  Comparing your run...
                </div>
              </div>
              <div class="stage-complete__stars" aria-label="Stage stars" data-stars="${stars}" style="gap: ${starGap};">
                <div class="star-column">
                  <span class="stage-star${stars >= 1 ? " is-filled" : ""}">✦</span>
                  ${bronzeLabel}
                </div>
                <div class="star-column">
                  <span class="stage-star${stars >= 2 ? " is-filled" : ""}">✦</span>
                  ${silverLabel}
                </div>
                <div class="star-column">
                  <span class="stage-star${stars >= 3 ? " is-filled" : ""}">✦</span>
                  ${goldLabel}
                  </div>
                ${stars >= 4 ? `
                  <div class="star-column">
                    <span class="stage-star is-filled is-secret">✦</span>
                    ${platinumLabel}
                  </div>
                  ` : ""}
              </div>
              <div class="stage-complete__bar-track">
                <div class="stage-complete__bar-fill" data-stars="${stars}"></div>
              </div>
            </div>
            <div class="leaderboard-panel" id="stageClearLeaderboard" data-stage-index="${stageState.index}">
              <div class="leaderboard-panel__title">Leaderboard</div>
              <div class="leaderboard-list" id="stageClearLeaderboardList">
                <div class="leaderboard-row">
                  <span>#</span>
                  <span>Player</span>
                  <span>Time</span>
                </div>
                <div class="leaderboard-row leaderboard-row--empty" id="stageClearLeaderboardEmpty">No data yet</div>
              </div>
            </div>
            <div class="stage-complete__actions">
              <button id="stageMenuButton" class="secondary icon-button" type="button" aria-label="Menu (${stageQuitKey})">
                <img class="action-icon" src="imgs/menu_button.png" alt="" />
                <span class="action-key-hint" aria-hidden="true">(${stageQuitKey})</span>
              </button>
              <button id="stageRetryButton" class="secondary icon-button" type="button" aria-label="Retry (${retryKey})">
                <img class="action-icon" src="imgs/retry_button.png" alt="" />
                <span class="action-countdown" aria-live="polite"></span>
                <span class="action-key-hint" aria-hidden="true">(${retryKey})</span>
              </button>
              <div class="stage-next-wrap">
                <div class="stage-next-timer" aria-hidden="true">
                  <span class="stage-next-timer__fill"></span>
                </div>
                <button id="stageNextButton" class="secondary icon-button button-entice" type="button" aria-label="Next (${stageNextKey})">
                  <img class="action-icon" src="imgs/next_button.png" alt="" />
                  <span class="action-key-hint" aria-hidden="true">(${stageNextKey})</span>
                </button>
              </div>
            </div>
          </div>
        `;
        resultsPanel.classList.add("show");

        if (typeof window.maybePromptPlayerName === "function") {
          window.maybePromptPlayerName();
        }

        const autoAdvanceDelayMs = 4500;
        if (autoAdvanceNextTimerId) {
          clearTimeout(autoAdvanceNextTimerId);
          autoAdvanceNextTimerId = null;
        }
        const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
        const hasNextStage = Boolean(stages[stageState.index + 1]);
        const nextTimer = document.querySelector("#resultsPanel .stage-next-timer");
        const nextTimerFill = nextTimer
          ? nextTimer.querySelector(".stage-next-timer__fill")
          : null;
        const startAutoAdvanceNext = () => {
          if (!hasNextStage) {
            if (nextTimer) {
              nextTimer.classList.add("is-disabled");
              nextTimer.classList.remove("is-running");
              nextTimer.classList.remove("is-canceled");
              nextTimer.classList.remove("is-waiting");
            }
            return;
          }
          const autoAdvanceEnabledNow = typeof autoAdvanceNextEnabled === "undefined"
            ? true
            : autoAdvanceNextEnabled;
          if (!autoAdvanceEnabledNow) {
            if (nextTimer) {
              nextTimer.classList.add("is-disabled");
            }
            return;
          }
          if (nextTimer) {
            nextTimer.classList.remove("is-running");
            nextTimer.classList.remove("is-canceled");
            nextTimer.classList.remove("is-disabled");
            nextTimer.classList.remove("is-waiting");
          }
          if (nextTimerFill) {
            nextTimerFill.style.removeProperty("transition");
            nextTimerFill.style.removeProperty("transition-duration");
            nextTimerFill.style.removeProperty("transform");
            nextTimerFill.style.transitionDuration = `${autoAdvanceDelayMs}ms`;
          }
          requestAnimationFrame(() => {
            if (nextTimer) {
              nextTimer.classList.add("is-running");
            }
          });
          autoAdvanceNextTimerId = window.setTimeout(() => {
            autoAdvanceNextTimerId = null;
            const nextBtn = document.getElementById("stageNextButton");
            if (nextBtn && stages[stageState.index + 1]) {
              if (typeof window.setStageIntroAnimationMode === "function") {
                window.setStageIntroAnimationMode("auto");
              }
              startStage(stageState.index + 1, { skipIntro: false, originEl: null });
            }
          }, autoAdvanceDelayMs);
        };
        const cancelAutoAdvanceNextFromResults = () => {
          if (autoAdvanceNextTimerId) {
            clearTimeout(autoAdvanceNextTimerId);
            autoAdvanceNextTimerId = null;
          }
          if (nextTimer) {
            if (!hasNextStage) {
              nextTimer.classList.add("is-disabled");
              nextTimer.classList.remove("is-running");
              nextTimer.classList.remove("is-canceled");
              nextTimer.classList.remove("is-waiting");
              return;
            }
            nextTimer.classList.remove("is-running");
            nextTimer.classList.remove("is-canceled");
            nextTimer.classList.add("is-waiting");
          }
          if (nextTimerFill) {
            nextTimerFill.style.removeProperty("transition");
            nextTimerFill.style.removeProperty("transition-duration");
            nextTimerFill.style.removeProperty("transform");
          }
        };
        window.startAutoAdvanceNextFromResults = startAutoAdvanceNext;
        window.cancelAutoAdvanceNextFromResults = cancelAutoAdvanceNextFromResults;
        const autoAdvanceEnabled = typeof autoAdvanceNextEnabled === "undefined"
          ? true
          : autoAdvanceNextEnabled;
        if (nextTimer) {
          nextTimer.classList.toggle("is-disabled", !autoAdvanceEnabled || !hasNextStage);
          if (!autoAdvanceEnabled || !hasNextStage) {
            nextTimer.classList.remove("is-waiting");
          }
        }
        if (autoAdvanceEnabled && hasNextStage) {
          const shouldDeferForName = typeof window.shouldPromptForPlayerName === "function"
            ? window.shouldPromptForPlayerName()
            : false;
          const deferred = typeof window.deferAutoAdvanceNext === "function"
            ? window.deferAutoAdvanceNext(startAutoAdvanceNext, shouldDeferForName)
            : false;
          if (deferred) {
            if (nextTimer) {
              nextTimer.classList.add("is-waiting");
            }
            if (nextTimerFill) {
              nextTimerFill.style.removeProperty("transition");
              nextTimerFill.style.removeProperty("transition-duration");
              nextTimerFill.style.removeProperty("transform");
            }
          } else {
            startAutoAdvanceNext();
          }
        }

        // Trigger bar fill animation after a short delay so the browser paints width:0 first

        const barFills = document.querySelectorAll("#resultsPanel .stage-complete__bar-fill");

        barFills.forEach(barFill => {
          const stars = parseInt(barFill.dataset.stars, 10) || 0;
          
          // set the final width based on stars
          // Set final width based on stars and how close to the next star threshold the time was
          let targetWidth = 0;
          let bronzeFill = 30;
          let silverFill = 50;
          let goldFill = 71;

          let nextTargetFill = bronzeFill;
          let timeDiffBetweenTargets = null;
          let timeFromPreviousTarget = null;

          if (stars === 1) {
            targetWidth = bronzeFill;
            nextTargetFill = silverFill;
            timeDiffBetweenTargets = bronzeTime - silverTime;
            timeFromPreviousTarget = bronzeTime - elapsedSeconds;
          }
          else if (stars === 2) {
            targetWidth = silverFill;
            nextTargetFill = goldFill;
            timeDiffBetweenTargets = silverTime - goldTime;
            timeFromPreviousTarget = silverTime - elapsedSeconds;
          }
          else if (stars >= 3) {
            targetWidth = 100;
          }

          if (timeDiffBetweenTargets && timeFromPreviousTarget && Number.isFinite(elapsedSeconds)) {
            const fillPercentDiff = nextTargetFill - targetWidth;
            // Make the fill difference between current and target into a percentage, add this to targetWidth
            const fillAdditionalPercent = timeFromPreviousTarget / timeDiffBetweenTargets * fillPercentDiff;
            console.log({ timeFromPreviousTarget, timeDiffBetweenTargets, fillPercentDiff, fillAdditionalPercent });
            targetWidth += fillAdditionalPercent;
          }

          if (stars === 0) {
            targetWidth = 5;
            distanceToBronze = elapsedSeconds - bronzeTime;
            if (distanceToBronze < 10) {
              // For times close to bronze, show a hint of the bronze fill
              targetWidth += bronzeFill / 10 * (10 - distanceToBronze);
              targetWidth = Math.min(targetWidth, bronzeFill - 0.5);
            }
          }
          
          barFill.style.width = "0";
          barFill.offsetWidth; // force browser to register width:0
            // Trigger transition
          setTimeout(() => {
            barFill.style.width = targetWidth + "%";
          }, 20); // small delay ensures browser painted initial width
        });

        const bestEl = document.getElementById("stageCompleteBestTime");
        if (bestEl && options.showBest) {
          const bestKey = window.getStageBestTimeKey
            ? window.getStageBestTimeKey(stage, stageState.index)
            : (stage && stage.id ? String(stage.id) : String(stageState.index + 1));
          const bestSeconds = Number(window.stageBestTimes && window.stageBestTimes[bestKey]);
          bestEl.textContent = Number.isFinite(bestSeconds)
            ? `(Best: ${bestSeconds.toFixed(2)}s)`
            : "";
        } else if (bestEl) {
          bestEl.textContent = "";
        }

        if (typeof window.renderStageLeaderboard === "function") {
          window.renderStageLeaderboard(stage, stageState.index, "stageClearLeaderboardList", "stageClearLeaderboardEmpty");
        }
        // const stageId = stage?.id || (stageState.index + 1);
        // const stageVersion = stage?.stageVersion || stage?.levelVersion || 1;

        // if (typeof window.fetchStageLeaderboard === 'function') {
        //   window.fetchStageLeaderboard(stageId, stageVersion, 10)
        //     .then(result => {
        //       if (!result || !result.top) return;
              
        //       const timeMetaEl = document.querySelector('.stage-complete__header .stage-meta');
        //       if (!timeMetaEl) return;
              
        //       const currentPlayerId = window.getLeaderboardPlayerId ? window.getLeaderboardPlayerId() : null;
        //       const playerTimeMs = Math.round(elapsedSeconds * 1000);
              
        //       // Calculate rank from leaderboard data
        //       let rank = null;
        //       let totalPlayers = result.top.length;
              
        //       // Check if player is in top list
        //       const playerInTop = result.top.findIndex(entry => entry.player_id === currentPlayerId);
        //       if (playerInTop !== -1) {
        //         rank = playerInTop + 1;
        //       } else if (result.me) {
        //         // Player not in top list but has a score
        //         // Count how many in top list are faster
        //         const fasterCount = result.top.filter(entry => entry.best_time_ms < playerTimeMs).length;
        //         rank = fasterCount + 1;
        //         totalPlayers = result.top.length + 1; // Approximate (at least this many)
        //       }
              
        //       if (!rank || totalPlayers < 2) return;
              
        //       const percentBeaten = Math.round(((totalPlayers - rank) / (totalPlayers - 1)) * 100);
        //       const playersSlowerThan = totalPlayers - rank;
              
        //       const rankEl = document.createElement('div');
        //       rankEl.className = 'stage-meta stage-rank-message';
              
        //       if (rank === 1) {
        //         rankEl.innerHTML = `<span class="rank-first">#1 out of ${totalPlayers}+ players!</span>`;
        //       } else if (percentBeaten >= 80) {
        //         rankEl.innerHTML = `<span class="rank-top">Top ${100 - percentBeaten}%! Better than ${playersSlowerThan}+ players</span>`;
        //       } else {
        //         rankEl.innerHTML = `<span class="rank-above-average">Better than ${percentBeaten}% of top players</span>`;
        //       }
              
        //       timeMetaEl.parentNode.appendChild(rankEl);
        //     })
        //     .catch(error => {
        //       console.error('Error displaying rank:', error);
        //     });
        // }

      }

      function refreshResultAutoActionCountdown() {
        if (typeof window.refreshResultAutoActionCountdown === "function") {
          window.refreshResultAutoActionCountdown();
        }
      }

      function lockInputs(locked) {
        inputGrid.querySelectorAll("input").forEach((input) => {
          input.disabled = locked;
        });
      }

      function getDefaultStatsPayload() {
        return {
          totalSeconds: 0,
          totalCards: 0,
          totalLevelAttempts: 0,
          totalLevelSuccesses: 0,
          failedLevelCount: 0,
          sandboxPlayed: false,
          cardTypeCounts: {},
          modifierVariantCounts: {}
        };
      }

      function normalizeStatsCounterMap(source) {
        const normalized = {};
        const input = source && typeof source === "object" ? source : {};
        Object.keys(input).forEach((key) => {
          const value = Math.max(0, Math.floor(Number(input[key]) || 0));
          if (value > 0) {
            normalized[key] = value;
          }
        });
        return normalized;
      }

      function mergeStatsCounterMaps(target, source) {
        const next = normalizeStatsCounterMap(target);
        const incoming = normalizeStatsCounterMap(source);
        Object.keys(incoming).forEach((key) => {
          next[key] = (Number(next[key]) || 0) + incoming[key];
        });
        return next;
      }

      function ensureSessionStatsObject() {
        if (!window.flashRecallSessionStats || typeof window.flashRecallSessionStats !== "object") {
          window.flashRecallSessionStats = getDefaultStatsPayload();
          return;
        }
        window.flashRecallSessionStats.totalSeconds = Number(window.flashRecallSessionStats.totalSeconds) || 0;
        window.flashRecallSessionStats.totalCards = Number(window.flashRecallSessionStats.totalCards) || 0;
        window.flashRecallSessionStats.totalLevelAttempts = Number(window.flashRecallSessionStats.totalLevelAttempts) || 0;
        window.flashRecallSessionStats.totalLevelSuccesses = Number(window.flashRecallSessionStats.totalLevelSuccesses) || 0;
        window.flashRecallSessionStats.failedLevelCount = Number(window.flashRecallSessionStats.failedLevelCount) || 0;
        window.flashRecallSessionStats.sandboxPlayed = Boolean(window.flashRecallSessionStats.sandboxPlayed);
        window.flashRecallSessionStats.cardTypeCounts = normalizeStatsCounterMap(window.flashRecallSessionStats.cardTypeCounts);
        window.flashRecallSessionStats.modifierVariantCounts = normalizeStatsCounterMap(window.flashRecallSessionStats.modifierVariantCounts);
      }

      function loadStoredStatsPayload() {
        const payload = getDefaultStatsPayload();
        try {
          const raw = window.localStorage.getItem("flashRecallStats");
          if (!raw) return payload;
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") return payload;
          payload.totalSeconds = Number(parsed.totalSeconds) || 0;
          payload.totalCards = Number(parsed.totalCards) || 0;
          payload.totalLevelAttempts = Number(parsed.totalLevelAttempts) || 0;
          payload.totalLevelSuccesses = Number(parsed.totalLevelSuccesses) || 0;
          payload.failedLevelCount = Number(parsed.failedLevelCount) || 0;
          payload.sandboxPlayed = Boolean(parsed.sandboxPlayed);
          payload.cardTypeCounts = normalizeStatsCounterMap(parsed.cardTypeCounts);
          payload.modifierVariantCounts = normalizeStatsCounterMap(parsed.modifierVariantCounts);
          return payload;
        } catch (error) {
          return getDefaultStatsPayload();
        }
      }

      function saveStoredStatsPayload(payload) {
        try {
          window.localStorage.setItem("flashRecallStats", JSON.stringify(payload));
        } catch (error) {
          // ignore storage errors
        }
      }

      function recordRoundStats(seconds, cardCount) {
        if (!Number.isFinite(seconds) || !Number.isFinite(cardCount) || cardCount <= 0) return;
        ensureSessionStatsObject();
        window.flashRecallSessionStats.totalSeconds += seconds;
        window.flashRecallSessionStats.totalCards += cardCount;
        const payload = loadStoredStatsPayload();
        payload.totalSeconds += seconds;
        payload.totalCards += cardCount;
        saveStoredStatsPayload(payload);
      }

      function recordCorrectCardAchievementProgress(entries, roundModifierKeys = []) {
        const safeEntries = Array.isArray(entries) ? entries : [];
        const roundModifiers = Array.isArray(roundModifierKeys) ? roundModifierKeys : [];
        const correctEntries = safeEntries.filter((entry) => entry && entry.correct);
        if (!correctEntries.length) return;
        const snapshot = {
          cardTypeCounts: {},
          modifierVariantCounts: {}
        };
        const perRoundModifiers = new Set(["swapCards", "platformer", "glitch", "fog", "blur", "ads"]);
        correctEntries.forEach((entry) => {
          if (entry.category) {
            snapshot.cardTypeCounts[entry.category] = (Number(snapshot.cardTypeCounts[entry.category]) || 0) + 1;
          }
          const entryModifiers = Array.isArray(entry.achievementModifiers) ? entry.achievementModifiers : [];
          entryModifiers.forEach((modifierKey) => {
            snapshot.modifierVariantCounts[modifierKey] = (Number(snapshot.modifierVariantCounts[modifierKey]) || 0) + 1;
          });
          roundModifiers.forEach((modifierKey) => {
            if (!perRoundModifiers.has(modifierKey)) return;
            snapshot.modifierVariantCounts[modifierKey] = (Number(snapshot.modifierVariantCounts[modifierKey]) || 0) + 1;
          });
        });
        ensureSessionStatsObject();
        const payload = loadStoredStatsPayload();
        window.flashRecallSessionStats.cardTypeCounts = mergeStatsCounterMaps(
          window.flashRecallSessionStats.cardTypeCounts,
          snapshot.cardTypeCounts
        );
        window.flashRecallSessionStats.modifierVariantCounts = mergeStatsCounterMaps(
          window.flashRecallSessionStats.modifierVariantCounts,
          snapshot.modifierVariantCounts
        );
        payload.cardTypeCounts = mergeStatsCounterMaps(payload.cardTypeCounts, snapshot.cardTypeCounts);
        payload.modifierVariantCounts = mergeStatsCounterMaps(payload.modifierVariantCounts, snapshot.modifierVariantCounts);
        saveStoredStatsPayload(payload);
      }

      function recordSandboxPlayedStat() {
        ensureSessionStatsObject();
        if (window.flashRecallSessionStats.sandboxPlayed) {
          return;
        }
        window.flashRecallSessionStats.sandboxPlayed = true;
        const payload = loadStoredStatsPayload();
        if (!payload.sandboxPlayed) {
          payload.sandboxPlayed = true;
          saveStoredStatsPayload(payload);
        }
      }

      function recordLevelAttemptStats(success, options = {}) {
        ensureSessionStatsObject();
        window.flashRecallSessionStats.totalLevelAttempts += 1;
        if (success) {
          window.flashRecallSessionStats.totalLevelSuccesses += 1;
        } else if (options.countFailure !== false) {
          window.flashRecallSessionStats.failedLevelCount += 1;
        }
        const payload = loadStoredStatsPayload();
        payload.totalLevelAttempts += 1;
        if (success) {
          payload.totalLevelSuccesses += 1;
        } else if (options.countFailure !== false) {
          payload.failedLevelCount += 1;
        }
        saveStoredStatsPayload(payload);
      }
      window.recordLevelAttemptStats = recordLevelAttemptStats;
      window.recordSandboxPlayedStat = recordSandboxPlayedStat;

      async function checkAnswers() {
        if (phase !== "recall") return;
        if (swapTimeoutId) {
          clearTimeout(swapTimeoutId);
          swapTimeoutId = null;
          swapStartTime = null;
          swapRemaining = null;
          swapStartRecall = null;
        }
        clearInterval(timerId);
        timerId = null;
        const platformerRequired = platformerState.required;
        const roundTimeSpent = (performance.now() - roundStartTime) / 1000;
        recordRoundStats(roundTimeSpent, roundItems.length);
        const activeRoundModifiers =
          typeof window.getCurrentModifierKeys === "function" ? window.getCurrentModifierKeys() : [];
        const entries = roundItems.map((item, index) => {
          const mappedIndex = swapMap ? swapMap[index] : index;
          const expectedItem = roundItems[mappedIndex];
          const input = inputGrid.querySelector(`input[data-index="${index}"]`);
          const raw = input ? input.value : "";
          const actual = normalize(raw);
          return {
            displayIndex: mappedIndex + 1,
            swappedWith: swapMap && mappedIndex !== index ? index + 1 : null,
            expected: buildExpectedLabel(expectedItem),
            actual,
            raw,
            correct: isCorrectAnswer(expectedItem, raw),
            category: expectedItem.category,
            answer: expectedItem.label || expectedItem,
            achievementModifiers: Array.isArray(expectedItem.achievementModifiers)
              ? expectedItem.achievementModifiers.slice()
              : []
          };
        });
        recordCorrectCardAchievementProgress(entries, activeRoundModifiers);
        if (gameMode === "practice" && typeof window.syncAchievementsFromLocal === "function") {
          window.syncAchievementsFromLocal({ usedModifiers: activeRoundModifiers });
        }
        window.__lastEntries = entries;
        const allCorrect =
          (!platformerRequired || (platformerState.completed && !platformerState.failed)) &&
          entries.every((entry) => entry.correct);
        window.__lastAllCorrect = allCorrect;
        updatePlatformerVisibility(false);
        if (allCorrect) {
          const flowToken = roundFlowToken;
          await playSuccessAnimation();
          if (flowToken !== roundFlowToken) {
            return;
          }
          if (gameMode === "stages") {
            const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
            const stageRounds = stage && stage.rounds ? stage.rounds : 1;
            if (round >= stageRounds) {
              stageState.completed = true;
              stageState.failed = false;
              const elapsedSeconds = Number.isFinite(stageState.elapsedSeconds)
                ? stageState.elapsedSeconds
                : (performance.now() - (stageState.startTime || performance.now())) / 1000;
              stageState.elapsedMs = elapsedSeconds * 1000;
              const stars = getStageStars(elapsedSeconds, stage);
          stageState.lastStars = stars;
          const saveResult = saveStageStars(stage, stars, elapsedSeconds);
          if (typeof window.updateStageLeaderboard === "function") {
            const stageId = stage && stage.id ? String(stage.id) : String(stageState.index + 1);
            const stageVersion = window.getStageVersion ? window.getStageVersion(stage) : 1;
            const name = typeof window.getPlayerName === "function" ? window.getPlayerName() : "";
            const leaderboardWrite = window.updateStageLeaderboard(stageId, stageVersion, elapsedSeconds, name);
            if (leaderboardWrite && typeof leaderboardWrite.then === "function") {
              leaderboardWrite.then(() => {
                if (typeof window.renderStageLeaderboard === "function") {
                  window.renderStageLeaderboard(stage, stageState.index, "stageClearLeaderboardList", "stageClearLeaderboardEmpty");
                }
              });
            }
          }
              // Analytics: Track level session
              recordLevelAttemptStats(true);
              if (typeof trackLevelSession === 'function') {
                const activeContext = typeof window.getActiveLevelContext === "function"
                  ? window.getActiveLevelContext()
                  : null;
                trackLevelSession(stageState.index, true, stars, elapsedSeconds, entries, "level_end", activeContext || {});
              }
              lastCompletedLevel = stageState.index + 1;
              lockInputs(true);
              renderCards(true);
              showStageComplete(elapsedSeconds, stars, stage, {
                showBest: Boolean(saveResult && saveResult.hadBest)
              });
              if (submitBtn) {
                submitBtn.disabled = true;
              }
              if (nextBtn) {
                nextBtn.disabled = false;
                nextBtn.textContent = "Back to stages";
              }
              setPhase("Stage complete", "result");
              refreshResultAutoActionCountdown();
              updateScore();
              return;
            }
            // Track the current successful round before moving to next
            const roundTimeSpent = (performance.now() - roundStartTime) / 1000;
            if (typeof trackRoundCompletion === 'function') {
              trackRoundCompletion(round, true, roundTimeSpent, {
                mode: gameMode,
                level_number: stageState.index + 1
              });
            }
            if (typeof window.setPreviousRoundItems === "function") {
              const ordered = swapMap ? swapMap.map((idx) => roundItems[idx]) : roundItems;
              window.setPreviousRoundItems(ordered);
            }
            startRound();
            return;
          }
          streak += 1;
          updateScore();
          if (typeof window.setPreviousRoundItems === "function") {
            const ordered = swapMap ? swapMap.map((idx) => roundItems[idx]) : roundItems;
            window.setPreviousRoundItems(ordered);
          }
          startRound();
          return;
        }
        if (gameMode === "stages") {
          lockInputs(true);
          const swapOrder = swapMap ? swapMap.slice() : null;
          swapActive = false;
          swapPair = null;
          swapMap = null;
          if (swapCleanup) {
            swapCleanup();
            swapCleanup = null;
          }
          showReviewFailure(entries, "stages", swapOrder);
          if (submitBtn) {
            submitBtn.disabled = true;
          }
          if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.textContent = "Retry stage";
          }
          if (typeof trackRoundCompletion === "function") {
            trackRoundCompletion(round, false, roundTimeSpent, {
              mode: gameMode,
              level_number: stageState.index + 1
            });
          }
          stageState.failed = true;
          stageState.completed = false;
          stageState.active = false;
          stopStageStopwatch();
          streak = 0;
          // Analytics: Track level failure
          const failedElapsedSeconds = Number.isFinite(stageState.elapsedSeconds)
            ? stageState.elapsedSeconds
            : (performance.now() - (stageState.startTime || performance.now())) / 1000;
          recordLevelAttemptStats(false);
          if (typeof trackLevelSession === 'function') {
            const activeContext = typeof window.getActiveLevelContext === "function"
              ? window.getActiveLevelContext()
              : null;
            trackLevelSession(stageState.index, false, 0, failedElapsedSeconds, entries, "level_end", activeContext || {});
          }
          setPhase("Round complete", "result");
          refreshResultAutoActionCountdown();
          updateScore();
          return;
        }
        if (gameMode === "practice") {
          if (typeof trackRoundCompletion === "function") {
            trackRoundCompletion(round, false, roundTimeSpent, {
              mode: gameMode
            });
          }
          lockInputs(true);
          const swapOrder = swapMap ? swapMap.slice() : null;
          swapActive = false;
          swapPair = null;
          swapMap = null;
          if (swapCleanup) {
            swapCleanup();
            swapCleanup = null;
          }
          showReviewFailure(entries, "practice", swapOrder);
          if (submitBtn) {
            submitBtn.disabled = true;
          }
          if (nextBtn) {
            nextBtn.disabled = true;
          }
          streak = 0;
          setPhase("Round complete", "result");
          refreshResultAutoActionCountdown();
          updateScore();
          return;
        }
        lockInputs(true);
        swapActive = false;
        swapPair = null;
        swapMap = null;
        if (swapCleanup) {
          swapCleanup();
          swapCleanup = null;
        }
        renderCards(true);
        if (submitBtn) {
          submitBtn.disabled = true;
        }
        if (nextBtn) {
          nextBtn.disabled = false;
        }
        if (nextBtn) {
          if (gameMode === "stages") {
            nextBtn.textContent = "Retry stage";
          } else {
            nextBtn.textContent = "Next round";
          }
        }
        streak = 0;
        setPhase("Round complete", "result");
        refreshResultAutoActionCountdown();
        updateScore();
      }

      function beginRecallPhase() {
        if (phase !== "show") return;
        clearInterval(timerId);
        timerId = null;
        clearAdTimer();
        if (swapTimeoutId) {
          clearTimeout(swapTimeoutId);
          swapTimeoutId = null;
          swapStartTime = null;
          swapRemaining = null;
          swapStartRecall = null;
        }
        if (swapCleanup) {
          swapCleanup();
          swapCleanup = null;
        }
        if (adEnabled && !adShownThisRound) {
          pendingSkipAfterAd = true;
          showAd();
          return;
        }
        hideAd();
        stopFog();
        stopBlur();
        stopGlitching();
        if (platformerState.required && !platformerState.completed) {
          platformerState.failed = true;
          lockInputs(true);
          renderCards(true);
          if (submitBtn) {
            submitBtn.disabled = true;
          }
          if (nextBtn) {
            nextBtn.disabled = false;
            if (gameMode === "stages") {
              nextBtn.textContent = "Retry stage";
            } else {
              nextBtn.textContent = "Next round";
            }
          }
          if (gameMode === "stages") {
            const entries = roundItems.map((item) => ({
              expected: buildExpectedLabel(item),
              actual: "",
              correct: false
            }));
            stageState.failed = true;
            stageState.completed = false;
            stageState.active = false;
            streak = 0;
            stopStageStopwatch();
            const failedElapsedSeconds = Number.isFinite(stageState.elapsedSeconds)
              ? stageState.elapsedSeconds
              : (performance.now() - (stageState.startTime || performance.now())) / 1000;
            recordLevelAttemptStats(false);
            if (typeof trackLevelSession === "function") {
              const activeContext = typeof window.getActiveLevelContext === "function"
                ? window.getActiveLevelContext()
                : null;
              trackLevelSession(stageState.index, false, 0, failedElapsedSeconds, entries, "level_end", activeContext || {});
            }
            showReviewFailure(entries, "stages");
          } else {
            const entries = roundItems.map((item) => ({
              expected: buildExpectedLabel(item),
              actual: "",
              correct: false
            }));
            showReviewFailure(entries, "practice");
          }
          setPhase("Round complete", "result");
          refreshResultAutoActionCountdown();
          updateScore();
          updatePlatformerVisibility(false);
          return;
        }
        updatePlatformerVisibility(false);
        swapActive = false;
        swapPair = null;
        swapMap = null;
        if (swapEnabled && roundItems.length > 1 && Math.random() < swapChance) {
          swapPair = pickSwapPair(roundItems.length);
          if (swapPair) {
            swapMap = roundItems.map((_, idx) => idx);
            swapMap[swapPair[0]] = swapPair[1];
            swapMap[swapPair[1]] = swapPair[0];
            swapActive = true;
          }
        }
        if (swapActive && typeof window.applyPreviousCardSwap === "function") {
          window.applyPreviousCardSwap(swapMap);
        }
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
          setTimer(getRecallSeconds(), "Recall", () => {
            checkAnswers();
          });
        };
        renderInputs();
        lockInputs(true);
        if (swapActive && swapPair) {
          animateSwap(swapPair[0], swapPair[1]);
          swapStartRecall = startRecall;
          swapRemaining = swapAnimationDuration + 200;
          swapStartTime = performance.now();
          swapTimeoutId = setTimeout(() => {
            swapTimeoutId = null;
            swapStartTime = null;
            swapRemaining = null;
            swapStartRecall = null;
            if (swapCleanup) {
              swapCleanup();
              swapCleanup = null;
            }
            startRecall();
          }, swapRemaining);
          return;
        }
        swapStartRecall = null;
        swapCleanup = null;
        startRecall();
      }

      function startRound(options = {}) {
        const { reuseItems = false, advanceRound = true } = options;
        if (typeof window.clearTabKeyHint === "function") {
          window.clearTabKeyHint();
        }
        if (typeof window.clearFirstLetterHint === "function") {
          window.clearFirstLetterHint();
        }
        document.body.classList.remove("stage-fail");
        if (gameMode === "stages" && !options.__flashOverride) {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          if (stage && String(stage.stageType).toLowerCase() === "flash" && typeof window.startFlashRound === "function") {
            window.startFlashRound();
            return;
          }
        }
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          if (!stage) {
            setPhase("No stages configured", "idle");
            return;
          }
          if (!stageState.active) {
            stageState.active = true;
            stageState.startTime = performance.now();
            stageState.completed = false;
            stageState.failed = false;
            startStageStopwatch();
            stageState.attempts = (stageState.attempts || 1) + 1;
            if (typeof trackLevelStart === "function") {
              trackLevelStart(stageState.index, {
                mode: gameMode,
                attempt_number: stageState.attempts,
                stage_name: stage && stage.name ? stage.name : null
              });
            }
          }
          const stageRounds = stage.rounds || 1;
          if (advanceRound && round >= stageRounds) {
            return;
          }
        }
        const nextRound = advanceRound ? round + 1 : round;
        const categories = getActiveCategories(nextRound);
        if (!categories.length) {
          setPhase("Select at least one card type", "idle");
          return;
        }
        if (advanceRound) {
          round += 1;
        }
        roundStartTime = performance.now();
        updateScore();
        resetBoard();
        if (!reuseItems) {
          roundItems = pickItems();
          roundItemsBase = roundItems.map((item) => ({ ...item }));
        } else {
          roundItems = roundItemsBase.map((item) => ({ ...item }));
        }
        if (advanceRound && gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          if (stage && stage.noRepeatAcrossRounds) {
            lastRoundItems = roundItems.map((item) => ({
              category: item.category,
              label: item.label
            }));
            lastRoundStageId = stage.id;
          } else {
            lastRoundItems = null;
            lastRoundStageId = null;
          }
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
        blurEnabled = isBlurEnabled();
        swapEnabled = isSwapEnabled();
        swapChance = getSwapChance();
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
        if (blurEnabled) {
          startBlur();
        } else {
          stopBlur();
        }
        const revealSeconds = getRevealSeconds();
        scheduleAd(revealSeconds);
        setTimer(revealSeconds, "Reveal", () => {
          beginRecallPhase();
        });
      }
