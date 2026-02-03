(() => {
  const storageKey = "flashRecallStageStars";
  window.stagesConfig = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
  window.stageStars = {};
  window.stageBestTimes = {};

  function loadStageStars() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        window.stageStars = parsed;
      }
    } catch (error) {
      console.warn("Failed to load stage stars", error);
    }
  }

  function saveStageStars() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(window.stageStars));
    } catch (error) {
      console.warn("Failed to save stage stars", error);
    }
  }

  loadStageStars();

  window.saveStageStars = saveStageStars;

  window.saveStageBestTimes = function saveStageBestTimes() {};

  window.getStageConfig = function getStageConfig(index) {
    if (!Array.isArray(window.stagesConfig)) return null;
    return window.stagesConfig[index] || null;
  };

  window.getStageCategories = function getStageCategories(stage) {
    if (!stage || !Array.isArray(stage.categories) || !stage.categories.length) {
      return ["numbers"];
    }
    return stage.categories.slice();
  };

  window.getStageModifiers = function getStageModifiers(stage) {
    const defaults = {
      mathOps: false,
      misleadColors: false,
      backgroundColor: false,
      swapCards: false,
      platformer: false,
      glitch: false,
      fog: false,
      ads: false
    };
    if (!stage || typeof stage.modifiers !== "object" || stage.modifiers === null) {
      return { ...defaults };
    }
    return { ...defaults, ...stage.modifiers };
  };

  window.getStageCardCount = function getStageCardCount(stage) {
    const count = stage && Number(stage.cards);
    return Number.isFinite(count) && count > 0 ? count : 4;
  };

  window.getStageStarTargets = function getStageStarTargets(stage) {
    const fallback = { platinum: null, gold: 30, silver: 45, bronze: 60 };
    if (!stage || !stage.starTimes) return fallback;
    return {
      platinum: Number(stage.starTimes.platinum) || fallback.platinum,
      gold: Number(stage.starTimes.gold) || fallback.gold,
      silver: Number(stage.starTimes.silver) || fallback.silver,
      bronze: Number(stage.starTimes.bronze) || fallback.bronze
    };
  };

  window.getStageChallengeOptions = function getStageChallengeOptions(stage) {
    const modifiers = window.getStageModifiers(stage);
    return {
      enableMathOps: Boolean(modifiers.mathOps),
      mathChance: 0.7,
      misleadColors: Boolean(modifiers.misleadColors),
      misleadChance: 0.6,
      enableBackgroundColor: Boolean(modifiers.backgroundColor),
      backgroundColorChance: 0.35,
      enableGlitch: Boolean(modifiers.glitch)
    };
  };

  window.getStageInstructionSlides = function getStageInstructionSlides(stage) {
    if (!stage || !Array.isArray(stage.instructions)) return { slides: [], result: [] };
    const raw = stage.instructions;
    if (
      raw.length &&
      raw[0] &&
      !Array.isArray(raw[0]) &&
      (Object.prototype.hasOwnProperty.call(raw[0], "reveal") ||
        Object.prototype.hasOwnProperty.call(raw[0], "recall"))
    ) {
      const slides = [];
      raw.forEach((entry) => {
        const reveal = Array.isArray(entry.reveal)
          ? entry.reveal
          : entry.reveal
            ? [entry.reveal]
            : [];
        const recall = Array.isArray(entry.recall)
          ? entry.recall
          : entry.recall
            ? [entry.recall]
            : [];
        slides.push(reveal, recall);
      });
      return { slides, result: Array.isArray(stage.resultInstructions) ? stage.resultInstructions : [] };
    }
    const slides = raw.map((entry) => {
      if (!entry) return [];
      return Array.isArray(entry) ? entry : [entry];
    });
    return { slides, result: Array.isArray(stage.resultInstructions) ? stage.resultInstructions : [] };
  };
})();
