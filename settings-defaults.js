(() => {
  const defaults = {
    appearance: {
      theme: "mono-ink",
      font: "arcade",
      layout: "classic",
      themes: [
        "mono-ink",
        "paper-night",
        "pastel-dawn",
        "pastel-mint",
        "neon-arcade",
        "neon-cyber",
        "sunset-pop",
        "ocean-deep",
        "forest-camp",
        "retro-terminal",
        "cherry-cream",
        "steel-grid"
      ],
      fonts: ["arcade", "mono", "rounded", "space", "poster"],
      layouts: ["classic", "focus", "arcade", "wide"]
    },
    controls: {
      successAnimation: true,
      flashCountdown: true,
      enterToNext: false,
      enterToRetry: false,
      flashWarningEnabled: true
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
