      /*
       * Modifier: Text color recall.
       * Chooses a text color for eligible cards.
       */
      function pickTextColor() {
        const choice = backgroundColors[Math.floor(Math.random() * backgroundColors.length)];
        if (typeof window.getAccessibleColorEntry === "function") {
          return window.getAccessibleColorEntry(choice.label, choice.color);
        }
        return choice;
      }
