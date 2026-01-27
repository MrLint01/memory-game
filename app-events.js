      function startTutorialStep(options = {}) {
        const { advanceRound = true } = options;
        const stepCount = window.getTutorialStepCount ? window.getTutorialStepCount() : 0;
        if (!stepCount) return;
        if (advanceRound) {
          tutorialState.stepIndex = Math.min(stepCount - 1, tutorialState.stepIndex + 1);
        }
        const step = window.getTutorialStep
          ? window.getTutorialStep(tutorialState.stepIndex)
          : null;
        tutorialState.currentStep = step;
        tutorialState.completed = false;
        round = tutorialState.stepIndex + 1;
        updateScore();
        resetBoard();
        if (tutorialMessage) {
          tutorialMessage.textContent = step && step.message ? step.message : "";
          tutorialMessage.style.display = tutorialMessage.textContent ? "block" : "none";
          applyTutorialMessagePosition(step);
        }
        if (tutorialRecallMessage) {
          tutorialRecallMessage.textContent = "";
          tutorialRecallMessage.style.display = "none";
          applyTutorialRecallMessagePosition(null);
        }
        if (!step) return;
        if (step.type === "prompt") {
          roundItems = [];
          roundItemsBase = [];
          renderCards(false);
          renderInputs();
          lockInputs(true);
          if (submitBtn) {
            submitBtn.disabled = true;
          }
          if (nextBtn) {
            nextBtn.disabled = true;
          }
          resultsPanel.classList.remove("show");
          setPhase("Tutorial", "show");
          updatePlatformerVisibility(false);
          stopFog();
          stopGlitching();
          return;
        }
        roundItems = (step.cards || []).map(buildTutorialCard);
        roundItemsBase = roundItems.map((item) => ({ ...item }));
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
        updatePlatformerVisibility(false);
        stopFog();
        stopGlitching();
        if (step.timed) {
          const revealSeconds = step.revealSeconds || getRevealSeconds();
          setTimer(revealSeconds, "Reveal", () => {
            beginRecallPhase();
          });
        }
      }

      function getRevealSeconds() {
        const base = Number(revealInput.value) || 5;
        if (gameMode === "tutorial") {
          const step = tutorialState.currentStep;
          if (step && step.timed && step.revealSeconds) {
            return step.revealSeconds;
          }
          return base;
        }
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
        if (gameMode === "tutorial") {
          const step = tutorialState.currentStep;
          if (step && step.timed && step.recallSeconds) {
            return step.recallSeconds;
          }
          return base;
        }
        if (gameMode === "stages") {
          const stage = window.getStageConfig ? window.getStageConfig(stageState.index) : null;
          if (stage && Number(stage.recallSeconds)) {
            return Number(stage.recallSeconds);
          }
        }
        return base;
      }

      function resetGame() {
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
        timerPill.textContent = "00";
        if (stageTimerPill) {
          stageTimerPill.textContent = "Time 0.00";
        }
        if (timerFill) {
          timerFill.style.width = "100%";
        }
        setPhase("Waiting to start", "idle");
        resetBoard();
        if (tutorialMessage) {
          tutorialMessage.style.display = "none";
          tutorialMessage.textContent = "";
        }
        if (submitBtn) {
          submitBtn.disabled = true;
        }
        if (nextBtn) {
          nextBtn.disabled = true;
          nextBtn.textContent = "Next round";
        }
      }

      function resetForRetryRound() {
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
        if (timerPill) {
          timerPill.textContent = "00";
        }
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
        document.querySelectorAll("#practiceModal .checkboxes input").forEach((input) => {
          input.disabled = false;
        });
        setModalState(practiceModal, true);
      }

      function closePracticeModal() {
        setModalState(practiceModal, false);
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
          { key: "ads", label: "Ads" }
        ];
        const enabled = entries.filter((entry) => modifiers && modifiers[entry.key]).map((entry) => entry.label);
        return enabled.length ? enabled.join(", ") : "None";
      }

      function renderStageList() {
        if (!stageList) return;
        const stages = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
        if (!stages.length) {
          stageList.innerHTML = "<div class=\"stage-meta\">No stages configured yet.</div>";
          return;
        }
        const perPage = 5;
        const totalPages = Math.max(1, Math.ceil(stages.length / perPage));
        if (stageState.page >= totalPages) {
          stageState.page = totalPages - 1;
        }
        const startIndex = stageState.page * perPage;
        const slice = stages.slice(startIndex, startIndex + perPage);
        stageList.innerHTML = slice
          .map((stage, offset) => {
            const index = startIndex + offset;
            const stageKey = stage && stage.id ? String(stage.id) : String(index + 1);
            const stars = window.stageStars && window.stageStars[stageKey] ? window.stageStars[stageKey] : 0;
            const starsMarkup = [1, 2, 3]
              .map((value) => {
                const filled = stars >= value ? " is-filled" : "";
                return `<span class="stage-star${filled}"></span>`;
              })
              .join("");
            const name = stage && stage.id ? String(stage.id) : String(index + 1);
            return `
              <button class="stage-card stage-card--clickable" type="button" data-stage-index="${index}">
                <strong>${name}</strong>
                <div class="stage-meta stage-stars">Stars: ${starsMarkup}</div>
              </button>
            `;
          })
          .join("");
        if (stagesPrev) {
          stagesPrev.disabled = stageState.page === 0;
        }
        if (stagesNext) {
          stagesNext.disabled = stageState.page >= totalPages - 1;
        }
        if (stagesFooter) {
          stagesFooter.textContent = `World ${stageState.page + 1} / ${totalPages}`;
        }
      }

      function openStagesScreen() {
        renderStageList();
        if (stagesScreen) {
          stagesScreen.removeAttribute("aria-hidden");
        }
        document.body.dataset.view = "stages";
      }

      function closeStagesScreen() {
        if (stagesScreen) {
          stagesScreen.setAttribute("aria-hidden", "true");
        }
        document.body.dataset.view = "home";
      }

      function startStage(index) {
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
        closeStagesScreen();
        startRound({ advanceRound: true });
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
          openStagesScreen();
        });
      }

      if (stagesOpen) {
        stagesOpen.addEventListener("click", () => {
          openStagesScreen();
        });
      }

      if (stagesBack) {
        stagesBack.addEventListener("click", () => {
          closeStagesScreen();
        });
      }
      if (stagesPrev) {
        stagesPrev.addEventListener("click", () => {
          if (stageState.page > 0) {
            stageState.page -= 1;
            renderStageList();
          }
        });
      }
      if (stagesNext) {
        stagesNext.addEventListener("click", () => {
          stageState.page += 1;
          renderStageList();
        });
      }

      if (stageList) {
        stageList.addEventListener("click", (event) => {
          const button = event.target.closest(".stage-card");
          if (!button) return;
          const index = Number(button.dataset.stageIndex);
          if (!Number.isFinite(index)) return;
          startStage(index);
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
      if (statsOpen && statsModal) {
        statsOpen.addEventListener("click", () => {
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
        modeSelect.value = "practice";
        updateModeUI();
        resetGame();
        closePracticeModal();
        startRound();
      });

      if (tutorialStart) {
        tutorialStart.addEventListener("click", () => {
          modeSelect.value = "tutorial";
          updateModeUI();
          resetGame();
          tutorialState.stepIndex = -1;
          startRound({ advanceRound: true });
        });
      }

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

      pauseResume.addEventListener("click", () => {
        closePauseModal();
        resumeFromPause();
      });

      pauseRestart.addEventListener("click", () => {
        closePauseModal();
        resetGame();
        startRound();
      });

      pauseQuit.addEventListener("click", () => {
        closePauseModal();
        if (gameMode === "stages") {
          resetStageProgress();
        }
        resetGame();
      });

      pauseModal.addEventListener("click", (event) => {
        if (event.target === pauseModal) {
          closePauseModal();
          resumeFromPause();
        }
      });
      if (pauseButton) {
        pauseButton.addEventListener("click", () => {
          openPauseModal();
        });
      }
      document.addEventListener("mousemove", (event) => {
        if (phase === "idle") {
          document.body.classList.remove("show-pause");
          return;
        }
        const nearLeft = event.clientX < 140;
        const nearTop = event.clientY < 120;
        if (nearLeft && nearTop) {
          document.body.classList.add("show-pause");
        } else {
          document.body.classList.remove("show-pause");
        }
      });

      if (submitBtn) {
        submitBtn.addEventListener("click", () => {
          checkAnswers();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          if (phase === "result" && gameMode === "tutorial") {
            if (tutorialState.completed) {
              resetGame();
              setPhase("Waiting to start", "idle");
              if (tutorialMessage) {
                tutorialMessage.style.display = "none";
              }
              return;
            }
            startTutorialStep({ advanceRound: false });
            return;
          }
          if (phase === "result" && gameMode === "stages") {
            if (stageState.completed) {
              resetStageProgress();
              resetGame();
              openStagesScreen();
              return;
            }
            if (stageState.failed) {
              stageState.failed = false;
              stageState.completed = false;
              stageState.startTime = performance.now();
              stageState.active = false;
              if (stageTimerId) {
                clearInterval(stageTimerId);
                stageTimerId = null;
              }
              resetGame();
              startRound({ advanceRound: true });
              return;
            }
          }
          startRound();
        });
      }

      if (resultsPanel) {
        resultsPanel.addEventListener("click", (event) => {
          const button = event.target.closest("#stageBackButton");
          if (button) {
            resetStageProgress();
            resetGame();
            openStagesScreen();
            return;
          }
          const practiceBack = event.target.closest("#practiceBackButton");
          if (practiceBack) {
            resetGame();
            setPhase("Waiting to start", "idle");
            return;
          }
          const practiceRetry = event.target.closest("#practiceRetryButton");
          if (practiceRetry) {
            resetForRetryRound();
            startRound({ reuseItems: false, advanceRound: false });
            return;
          }
          const retryButton = event.target.closest("#stageRetryButton");
          if (!retryButton) return;
          stageState.failed = false;
          stageState.completed = false;
          stageState.startTime = performance.now();
          stageState.active = false;
          if (stageTimerId) {
            clearInterval(stageTimerId);
            stageTimerId = null;
          }
          resetGame();
          startRound({ advanceRound: true });
          return;
        });
      }

      modeSelect.addEventListener("change", () => {
        if (modeSelect.value !== "stages") {
          resetStageProgress();
        }
        updateModeUI();
        resetGame();
      });

      document.addEventListener("keydown", (event) => {
        if (pauseModal.classList.contains("show") && event.key === "Escape") {
          event.preventDefault();
          closePauseModal();
          resumeFromPause();
          return;
        }
        if (pauseModal.classList.contains("show")) {
          if (event.key === "Enter") {
            event.preventDefault();
          }
          return;
        }
        if (referenceModal && referenceModal.classList.contains("show")) {
          if (event.key === "Escape") {
            event.preventDefault();
            setModalState(referenceModal, false);
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
        if (gameMode === "tutorial" && tutorialState.currentStep && tutorialState.currentStep.type === "prompt") {
          if (event.key === "Enter") {
            event.preventDefault();
            startTutorialStep({ advanceRound: true });
          } else if (event.key === "Escape") {
            event.preventDefault();
            resetGame();
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          openPauseModal();
          return;
        }
        if (event.key !== "Enter") return;
        if (phase === "recall" && (swapTimeoutId || swapStartRecall)) {
          event.preventDefault();
          return;
        }
        if (gameMode === "tutorial" && phase === "result") {
          event.preventDefault();
          if (tutorialState.completed) {
            resetGame();
            setPhase("Waiting to start", "idle");
            if (tutorialMessage) {
              tutorialMessage.style.display = "none";
            }
          } else {
            startTutorialStep({ advanceRound: false });
          }
          return;
        }
        if (phase === "show") {
          skipRevealNow();
        } else if (phase === "recall") {
          checkAnswers();
        } else if (phase === "result") {
          startRound();
        }
      });

      updateModeUI();
      resetGame();
      updateCategoryControls();
