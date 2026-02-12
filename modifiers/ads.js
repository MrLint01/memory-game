      /*
       * Modifier: Pop-up ads during reveal.
       * Manages ad timing, placement, display, and interaction lockouts.
       */
      function showAd(options = {}) {
        const { reuseSnapshot = false } = options;
        if (!adEnabled) return;
        if (adActive) return;
        if (pauseModal && pauseModal.classList.contains("show")) return;
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
