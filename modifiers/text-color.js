      /*
       * Modifier: Text color recall.
       * Chooses a text color for eligible cards.
       */
      function pickTextColor() {
        return backgroundColors[Math.floor(Math.random() * backgroundColors.length)];
      }
