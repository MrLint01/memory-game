(() => {
  const progressKey = "flashRecallStageProgress";
  window.stagesConfig = Array.isArray(window.stagesConfig) ? window.stagesConfig : [];
  window.stageStars = {};
  window.stageBestTimes = {};
  window.stageCompleted = {};

  function loadStageProgress() {
    try {
      const raw = window.localStorage.getItem(progressKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return false;
      if (parsed.stars && typeof parsed.stars === "object") {
        window.stageStars = parsed.stars;
      }
      if (parsed.completed && typeof parsed.completed === "object") {
        window.stageCompleted = parsed.completed;
      }
      if (parsed.bestTimes && typeof parsed.bestTimes === "object") {
        window.stageBestTimes = parsed.bestTimes;
      }
      return true;
    } catch (error) {
      console.warn("Failed to load stage progress", error);
      return false;
    }
  }

  function saveStageProgress() {
    try {
      const payload = {
        stars: window.stageStars,
        completed: window.stageCompleted,
        bestTimes: window.stageBestTimes
      };
      window.localStorage.setItem(progressKey, JSON.stringify(payload));
    } catch (error) {
      console.warn("Failed to save stage progress", error);
    }
  }
  loadStageProgress();

  window.saveStageProgress = saveStageProgress;

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
        textColor: false,
        previousCard: false,
        rotate: false,
        rotatePlus: false,
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

  window.getStageCardCounts = function getStageCardCounts(stage) {
    if (!stage || typeof stage.cardCounts !== "object" || stage.cardCounts === null) {
      return null;
    }
    return { ...stage.cardCounts };
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
        mathChance: typeof modifiers.mathChance === "number" ? modifiers.mathChance : 0.7,
        mathMinCount: typeof modifiers.mathMinCount === "number" ? modifiers.mathMinCount : null,
        mathMaxCount: typeof modifiers.mathMaxCount === "number" ? modifiers.mathMaxCount : null,
        misleadColors: Boolean(modifiers.misleadColors),
        misleadChance: typeof modifiers.misleadChance === "number" ? modifiers.misleadChance : 0.6,
        misleadMinCount: typeof modifiers.misleadMinCount === "number" ? modifiers.misleadMinCount : null,
        misleadMaxCount: typeof modifiers.misleadMaxCount === "number" ? modifiers.misleadMaxCount : null,
        enableBackgroundColor: Boolean(modifiers.backgroundColor),
        backgroundColorChance:
          typeof modifiers.backgroundColorChance === "number" ? modifiers.backgroundColorChance : 0.35,
        backgroundPromptChance:
          typeof modifiers.backgroundPromptChance === "number" ? modifiers.backgroundPromptChance : 0.5,
        backgroundPromptMinCount:
          typeof modifiers.backgroundPromptMinCount === "number" ? modifiers.backgroundPromptMinCount : null,
        backgroundPromptMaxCount:
          typeof modifiers.backgroundPromptMaxCount === "number" ? modifiers.backgroundPromptMaxCount : null,
        enableTextColor: Boolean(modifiers.textColor),
        textColorChance: typeof modifiers.textColorChance === "number" ? modifiers.textColorChance : 0.6,
        textPromptChance: typeof modifiers.textPromptChance === "number" ? modifiers.textPromptChance : 0.5,
        textPromptMinCount:
          typeof modifiers.textPromptMinCount === "number" ? modifiers.textPromptMinCount : null,
        textPromptMaxCount:
          typeof modifiers.textPromptMaxCount === "number" ? modifiers.textPromptMaxCount : null,
        enablePreviousCard: Boolean(modifiers.previousCard),
        previousCardChance: typeof modifiers.previousCardChance === "number" ? modifiers.previousCardChance : 0.5,
        previousPromptMinCount:
          typeof modifiers.previousPromptMinCount === "number" ? modifiers.previousPromptMinCount : null,
        previousPromptMaxCount:
          typeof modifiers.previousPromptMaxCount === "number" ? modifiers.previousPromptMaxCount : null,
        enableRotate: Boolean(modifiers.rotate),
        enableRotatePlus: Boolean(modifiers.rotatePlus),
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
