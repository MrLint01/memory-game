      /*
       * Modifier: Misleading color text.
       * Picks an incorrect color label to display.
       */
      function pickMisleadingLabel(actualLabel) {
        const options = dataSets.colors
          .map((color) => color.label)
          .filter((label) => label.toLowerCase() !== actualLabel.toLowerCase());
        return options[Math.floor(Math.random() * options.length)];
      }
