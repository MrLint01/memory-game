      /*
       * Modifier: Glitching reveal.
       * Flickers cards on/off during reveal.
       */
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
