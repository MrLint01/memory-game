      /*
       * Modifier: Fog reveal.
       * Renders a fog overlay and clears it based on cursor movement.
       */
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
