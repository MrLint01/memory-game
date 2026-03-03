(() => {
  const defaults = {
    appearance: {
      theme: "mono-ink",
      font: "original",
      layout: "classic",
      themes: [
        "mono-ink",
        "paper-night",
        "pastel-dawn",
        "pastel-mint",
        "sunset-pop",
        "ocean-deep",
        "forest-camp",
        "cherry-cream",
        "steel-grid"
      ],
      fonts: ["original", "arcade", "rounded", "space", "mono", "poster"],
      layouts: ["classic"]
    },
    controls: {
      successAnimation: true,
      flashCountdown: true,
      enterToNext: false,
      enterToRetry: false,
      flashWarningEnabled: true
    },
    audio: {
      master: 100,
      music: 80,
      effects: 80
    },
    keybinds: {
      retry: "r",
      stageNext: "n",
      stageQuit: "q",
      practiceHome: "h",
      practiceSettings: "s"
    },
    playerName: {
      value: ""
    }
  };

  window.FLASH_RECALL_SETTINGS_DEFAULTS = defaults;
  window.getFlashRecallSettingsDefaults = function getFlashRecallSettingsDefaults() {
    return JSON.parse(JSON.stringify(defaults));
  };
})();
