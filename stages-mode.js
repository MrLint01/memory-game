(() => {
  let stageRoundOverridePlan = null;
  let stageRoundOverrideStageId = null;
  let stageRoundOverrideLastRound = null;

  function shuffleArray(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function buildRoundOverridePlan(stage, pool) {
    const rounds = Number(stage && stage.rounds) || pool.length;
    const shuffled = shuffleArray(pool.slice());
    const plan = {};
    for (let i = 1; i <= rounds; i += 1) {
      plan[i] = shuffled[i - 1] ?? null;
    }
    return plan;
  }

  window.getStageRoundOverride = function getStageRoundOverride(stage, currentRound) {
    if (!stage || !Number.isFinite(currentRound)) return null;
    if (stage.roundOverrides && typeof stage.roundOverrides === "object") {
      return stage.roundOverrides[currentRound] || null;
    }
    const pool = Array.isArray(stage.roundOverridePool) ? stage.roundOverridePool : null;
    if (!pool || !pool.length) return null;
    const stageId = stage.id ?? null;
    const shouldReset =
      stageRoundOverrideStageId !== stageId ||
      stageRoundOverridePlan === null ||
      (stageRoundOverrideLastRound !== null &&
        (currentRound < stageRoundOverrideLastRound || (currentRound === 1 && stageRoundOverrideLastRound !== 1)));
    if (shouldReset) {
      stageRoundOverridePlan = buildRoundOverridePlan(stage, pool);
      stageRoundOverrideStageId = stageId;
    }
    stageRoundOverrideLastRound = currentRound;
    return stageRoundOverridePlan ? stageRoundOverridePlan[currentRound] || null : null;
  };

  window.resetStageRoundOverridePlan = function resetStageRoundOverridePlan() {
    stageRoundOverridePlan = null;
    stageRoundOverrideStageId = null;
    stageRoundOverrideLastRound = null;
  };
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
        const stars = { ...parsed.stars };
        // One-time migration: copy legacy keys without version suffix into v1 keys.
        Object.keys(stars).forEach((key) => {
          if (/_v\d+$/.test(key)) return;
          const legacyValue = stars[key];
          const v1Key = `${key}_v1`;
          if (stars[v1Key] === undefined && Number.isFinite(Number(legacyValue))) {
            stars[v1Key] = legacyValue;
          }
          delete stars[key];
        });
        window.stageStars = stars;
      }
      if (parsed.completed && typeof parsed.completed === "object") {
        const completed = { ...parsed.completed };
        // One-time migration: copy legacy keys without version suffix into v1 keys.
        Object.keys(completed).forEach((key) => {
          if (/_v\d+$/.test(key)) return;
          const v1Key = `${key}_v1`;
          if (completed[v1Key] === undefined) {
            completed[v1Key] = Boolean(completed[key]);
          }
          delete completed[key];
        });
        window.stageCompleted = completed;
      }
      if (parsed.bestTimes && typeof parsed.bestTimes === "object") {
        const bestTimes = { ...parsed.bestTimes };
        // One-time migration: copy legacy keys without version suffix into v1 keys.
        Object.keys(bestTimes).forEach((key) => {
          if (/_v\d+$/.test(key)) return;
          const legacyValue = bestTimes[key];
          const v1Key = `${key}_v1`;
          if (bestTimes[v1Key] === undefined && Number.isFinite(Number(legacyValue))) {
            bestTimes[v1Key] = legacyValue;
          }
          delete bestTimes[key];
        });
        window.stageBestTimes = bestTimes;
      }
      if (typeof window.syncLocalBestTimesOnce === "function") {
        window.syncLocalBestTimesOnce();
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

  window.getStageVersion = function getStageVersion(stage) {
    const version = stage && Number(stage.version);
    return Number.isFinite(version) && version > 0 ? version : 1;
  };

  window.getStageBestTimeKey = function getStageBestTimeKey(stage, index) {
    const id = stage && stage.id ? String(stage.id) : String(index + 1);
    const version = window.getStageVersion ? window.getStageVersion(stage) : 1;
    return `${id}_v${version}`;
  };

  window.getStageStarsKey = function getStageStarsKey(stage, index) {
    const id = stage && stage.id ? String(stage.id) : String(index + 1);
    const version = window.getStageVersion ? window.getStageVersion(stage) : 1;
    return `${id}_v${version}`;
  };

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
        mathOpsPlus: false,
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
      const options = { ...defaults };
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

  window.getStageChallengeOptions = function getStageChallengeOptions(stage, currentRound) {
    const modifiers = window.getStageModifiers(stage);
    const options = {
      enableMathOps: Boolean(modifiers.mathOps),
      enableMathOpsPlus: Boolean(modifiers.mathOpsPlus),
      mathChance: typeof modifiers.mathChance === "number" ? modifiers.mathChance : 0.7,
      mathMinCount: typeof modifiers.mathMinCount === "number" ? modifiers.mathMinCount : null,
      mathMaxCount: typeof modifiers.mathMaxCount === "number" ? modifiers.mathMaxCount : null,
      misleadColors: Boolean(modifiers.misleadColors),
      misleadChance: typeof modifiers.misleadChance === "number" ? modifiers.misleadChance : 0.6,
      misleadUniqueLabelsPerRound: Boolean(modifiers.misleadUniqueLabelsPerRound),
      textLabelUniquePerRound: Boolean(modifiers.textLabelUniquePerRound),
      misleadMinCount: typeof modifiers.misleadMinCount === "number" ? modifiers.misleadMinCount : null,
      misleadMaxCount: typeof modifiers.misleadMaxCount === "number" ? modifiers.misleadMaxCount : null,
      enableBackgroundColor: Boolean(modifiers.backgroundColor),
      backgroundColorChance:
        typeof modifiers.backgroundColorChance === "number" ? modifiers.backgroundColorChance : 0.35,
      backgroundColorMinCount:
        typeof modifiers.backgroundColorMinCount === "number" ? modifiers.backgroundColorMinCount : null,
      backgroundColorMaxCount:
        typeof modifiers.backgroundColorMaxCount === "number" ? modifiers.backgroundColorMaxCount : null,
      backgroundColorUniqueLabelsPerRound: Boolean(modifiers.backgroundColorUniqueLabelsPerRound),
      backgroundPromptChance:
        typeof modifiers.backgroundPromptChance === "number" ? modifiers.backgroundPromptChance : 0.5,
      backgroundPromptMinCount:
        typeof modifiers.backgroundPromptMinCount === "number" ? modifiers.backgroundPromptMinCount : null,
      backgroundPromptMaxCount:
        typeof modifiers.backgroundPromptMaxCount === "number" ? modifiers.backgroundPromptMaxCount : null,
      enableTextColor: Boolean(modifiers.textColor),
      textColorChance: typeof modifiers.textColorChance === "number" ? modifiers.textColorChance : 0.6,
      textPromptChance: typeof modifiers.textPromptChance === "number" ? modifiers.textPromptChance : 0.5,
      textColorUniqueLabelsPerRound: Boolean(modifiers.textColorUniqueLabelsPerRound),
      textColorAvoidCardBackground: Boolean(modifiers.textColorAvoidCardBackground),
      textColorNoAdjacent: Boolean(modifiers.textColorNoAdjacent),
      textColorMatchCardBackground: Boolean(modifiers.textColorMatchCardBackground),
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
      rotateUniqueDegreesPerRound: Boolean(modifiers.rotateUniqueDegreesPerRound),
      rotateNoRepeatPromptsAcrossRounds: Boolean(modifiers.rotateNoRepeatPromptsAcrossRounds),
      rotateChance: typeof modifiers.rotateChance === "number" ? modifiers.rotateChance : null,
      rotateMinCount: typeof modifiers.rotateMinCount === "number" ? modifiers.rotateMinCount : null,
      rotateMaxCount: typeof modifiers.rotateMaxCount === "number" ? modifiers.rotateMaxCount : null,
      rotatePlusChance: typeof modifiers.rotatePlusChance === "number" ? modifiers.rotatePlusChance : null,
      rotatePlusMinCount: typeof modifiers.rotatePlusMinCount === "number" ? modifiers.rotatePlusMinCount : null,
      rotatePlusMaxCount: typeof modifiers.rotatePlusMaxCount === "number" ? modifiers.rotatePlusMaxCount : null,
      enableGlitch: Boolean(modifiers.glitch)
    };

    const roundOverride =
      stage && Number.isFinite(currentRound) && typeof window.getStageRoundOverride === "function"
        ? window.getStageRoundOverride(stage, currentRound)
        : null;
    if (roundOverride && roundOverride.prompts && typeof roundOverride.prompts === "object") {
      const overrides = roundOverride.prompts;
      options.mathMinCount = null;
      options.mathMaxCount = null;
      options.misleadMinCount = null;
      options.misleadMaxCount = null;
      options.backgroundPromptMinCount = null;
      options.backgroundPromptMaxCount = null;
      options.textPromptMinCount = null;
      options.textPromptMaxCount = null;
      options.previousPromptMinCount = null;
      options.previousPromptMaxCount = null;
      options.rotateMinCount = null;
      options.rotateMaxCount = null;
      options.rotatePlusMinCount = null;
      options.rotatePlusMaxCount = null;


      const hasMathOpsOverride = Object.prototype.hasOwnProperty.call(overrides, "mathOps");
      const hasMathOpsPlusOverride = Object.prototype.hasOwnProperty.call(overrides, "mathOpsPlus");
      if (hasMathOpsOverride || hasMathOpsPlusOverride) {
        options.enableMathOps = hasMathOpsOverride;
        options.enableMathOpsPlus = hasMathOpsPlusOverride;
      }
      const hasRotateOverride = Object.prototype.hasOwnProperty.call(overrides, "rotate");
      const hasRotatePlusOverride = Object.prototype.hasOwnProperty.call(overrides, "rotatePlus");
      if (hasRotateOverride || hasRotatePlusOverride) {
        options.enableRotate = hasRotateOverride;
        options.enableRotatePlus = hasRotatePlusOverride;
      }

      const getCounts = (value) => {
        if (typeof value === "number") {
          return { min: value, max: null };
        }
        if (value && typeof value === "object") {
          const min = typeof value.min === "number" ? value.min : null;
          const max = typeof value.max === "number" ? value.max : null;
          return { min, max };
        }
        return { min: null, max: null };
      };

      if (Object.prototype.hasOwnProperty.call(overrides, "background")) {
        const { min, max } = getCounts(overrides.background);
        options.enableBackgroundColor = true;
        options.backgroundPromptMinCount = min;
        options.backgroundPromptMaxCount = max;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, "textColor")) {
        const { min, max } = getCounts(overrides.textColor);
        options.enableTextColor = true;
        options.textPromptMinCount = min;
        options.textPromptMaxCount = max;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, "previousCard")) {
        const { min, max } = getCounts(overrides.previousCard);
        options.enablePreviousCard = true;
        options.previousPromptMinCount = min;
        options.previousPromptMaxCount = max;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, "misleadColors")) {
        const { min, max } = getCounts(overrides.misleadColors);
        options.misleadColors = true;
        options.misleadMinCount = min;
        options.misleadMaxCount = max;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, "mathOps")) {
        const { min, max } = getCounts(overrides.mathOps);
        options.enableMathOps = true;
        options.mathMinCount = min;
        options.mathMaxCount = max;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, "mathOpsPlus")) {
        const { min, max } = getCounts(overrides.mathOpsPlus);
        options.enableMathOpsPlus = true;
        options.mathMinCount = min;
        options.mathMaxCount = max;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, "rotate")) {
        const { min, max } = getCounts(overrides.rotate);
        options.enableRotate = true;
        options.rotateMinCount = min;
        options.rotateMaxCount = max;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, "rotatePlus")) {
        const { min, max } = getCounts(overrides.rotatePlus);
        options.enableRotatePlus = true;
        options.rotatePlusMinCount = min;
        options.rotatePlusMaxCount = max;
      }
    }

    return options;
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
