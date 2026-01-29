
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

      function startStageStopwatch() {
        if (!stageTimerPill) return;
        if (stageTimerId) {
          clearInterval(stageTimerId);
        }
        const startTime = stageState.startTime || performance.now();
        stageTimerId = setInterval(() => {
          const elapsedMs = performance.now() - startTime;
          const seconds = (elapsedMs / 1000).toFixed(2);
          stageTimerPill.textContent = `Time ${seconds}`;
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
        if (phase === "idle") {
          return;
        }
        pausedState = {
          phase,
          phaseText: phasePill.textContent,
          timer: null,
          adWasActive: false,
          fogWasActive: false,
          adSnapshot: null,
          glitchWasActive: false,
          swapRemaining: null
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
        if (swapTimeoutId && swapStartTime) {
          const elapsed = performance.now() - swapStartTime;
          swapRemaining = Math.max(0, (swapRemaining ?? 0) - elapsed);
          pausedState.swapRemaining = swapRemaining;
          clearTimeout(swapTimeoutId);
          swapTimeoutId = null;
          swapStartTime = null;
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
            prompt.textContent = entry.expected.label;
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
        const buttons =
          mode === "stages"
            ? `<button id="stageRetryButton" class="secondary" type="button">Retry stage</button>
               <button id="stageBackButton" class="secondary" type="button">Back to stages</button>`
            : `<button id="practiceRetryButton" class="secondary" type="button">Retry round</button>
               <button id="practiceBackButton" class="secondary" type="button">Back to menu</button>`;
        resultsPanel.innerHTML = `
          <div class="stage-complete">
            <div class="stage-complete__header"></div>
            <div class="stage-complete__actions">
              ${buttons}
            </div>
          </div>
        `;
        resultsPanel.classList.add("show");
      }

      function getStageStars(elapsedSeconds, stage) {
        const targets = window.getStageStarTargets ? window.getStageStarTargets(stage) : null;
        if (!targets) return 0;
        if (elapsedSeconds <= targets.gold) return 3;
        if (elapsedSeconds <= targets.silver) return 2;
        if (elapsedSeconds <= targets.bronze) return 1;
        return 0;
      }

      function saveStageStars(stage, stars) {
        if (!stage || !window.stageStars) return;
        const key = stage.id ? String(stage.id) : String(stageState.index + 1);
        
        // Save stars (keep the highest)
        const current = window.stageStars[key] || 0;
        if (stars > current) {
          window.stageStars[key] = stars;
        }
        
        // Mark as completed (regardless of stars)
        if (!window.stageCompleted) {
          window.stageCompleted = {};
        }
        window.stageCompleted[key] = true;
        
        // Call the global save function if it exists
        if (window.saveStageStars) {
          window.saveStageStars();
        }
      }

      function showStageComplete(elapsedSeconds, stars, stage) {
        stopStageStopwatch();
        document.body.classList.remove("stage-fail");
        cardGrid.innerHTML = "";
        inputGrid.innerHTML = "";
        const starText = "*".repeat(stars).padEnd(3, "-");
        const stageName = stage && stage.name ? stage.name : `Stage ${stageState.index + 1}`;
        resultsPanel.innerHTML = `
          <div class="stage-complete">
            <div class="stage-complete__header">
              <strong>${stageName} complete!</strong>
              <div class="stage-meta">Time: ${elapsedSeconds.toFixed(2)}s</div>
            </div>
            <div class="stage-complete__stars" aria-label="Stage stars">
              <span class="stage-star${stars >= 1 ? " is-filled" : ""}"></span>
              <span class="stage-star${stars >= 2 ? " is-filled" : ""}"></span>
              <span class="stage-star${stars >= 3 ? " is-filled" : ""}"></span>
            </div>
            <div class="stage-complete__actions">
              <button id="stageBackButton" class="secondary" type="button">Back to stages</button>
            </div>
          </div>
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
            correct: isCorrectAnswer(expectedItem, raw)
          };
        });
        window.__lastEntries = entries;
        const allCorrect =
          (!platformerRequired || (platformerState.completed && !platformerState.failed)) &&
          entries.every((entry) => entry.correct);
        window.__lastAllCorrect = allCorrect;
        updatePlatformerVisibility(false);
        if (allCorrect) {
          if (gameMode === "stages") {
            const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
            const stageRounds = stage && stage.rounds ? stage.rounds : 1;
            if (round >= stageRounds) {
              stageState.completed = true;
              stageState.failed = false;
              stageState.elapsedMs = performance.now() - (stageState.startTime || performance.now());
              const elapsedSeconds = stageState.elapsedMs / 1000;
              const stars = getStageStars(elapsedSeconds, stage);
              stageState.lastStars = stars;
              saveStageStars(stage, stars);
              lockInputs(true);
              renderCards(true);
              showStageComplete(elapsedSeconds, stars, stage);
              if (submitBtn) {
                submitBtn.disabled = true;
              }
              if (nextBtn) {
                nextBtn.disabled = false;
                nextBtn.textContent = "Back to stages";
              }
              setPhase("Stage complete", "result");
              updateScore();
              return;
            }
            startRound();
            return;
          }
          streak += 1;
          updateScore();
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
          stageState.failed = true;
          stageState.completed = false;
          stageState.active = false;
          stopStageStopwatch();
          streak = 0;
          setPhase("Round complete", "result");
          updateScore();
          return;
        }
        if (gameMode === "practice") {
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
            stopStageStopwatch();
            streak = 0;
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
        document.body.classList.remove("stage-fail");
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
