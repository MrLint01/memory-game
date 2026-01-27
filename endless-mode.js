window.endlessRules = {
  categoriesByRound: [
    { round: 1, categories: ["numbers"] },
    { round: 3, categories: ["numbers", "colors"] },
    { round: 10, categories: ["colors"] },
    { round: 12, categories: ["numbers", "colors"] },
    { round: 15, categories: ["numbers"] },
    { round: 17, categories: ["numbers", "colors", "letters"] },
    { round: 25, categories: ["colors"] },
    { round: 28, categories: ["numbers", "colors", "letters", "directions"] },
    { round: 30, categories: ["numbers", "colors", "letters", "directions", "shapes"] }
  ],
  modifiersByRound: {
    mathOps: 15,
    misleadColors: 25,
    backgroundColor: 30,
    swapCards: 50,
    platformer: 55,
    glitch: 35,
    fog: 20,
    ads: 40
  },
  cardCountByRound: [
  { round: 1, count: 1 },
  { round: 3, count: 2 },
  { round: 10, count: 3 },
  { round: 15, count: 2 },
  { round: 25, count: 1 },
  { round: 28, count: 2 },
  { round: 35, count: 3 },
  { round: 50, count: 4 },
  { round: 75, count: 5 },
  { round: 95, count: 6 }
  ]
};

function getEndlessRuleEntry(list, round) {
  if (!Array.isArray(list) || !list.length) return null;
  let chosen = list[0];
  list.forEach((entry) => {
    if (round >= entry.round) {
      chosen = entry;
    }
  });
  return chosen;
}

window.getEndlessCategories = function getEndlessCategories(round) {
  const entry = getEndlessRuleEntry(window.endlessRules.categoriesByRound, round);
  if (!entry || !entry.categories) return ["numbers"];
  return entry.categories.slice();
};

window.getEndlessModifiers = function getEndlessModifiers(round) {
  const rules = window.endlessRules.modifiersByRound || {};
  return {
    mathOps: round >= (rules.mathOps || Infinity),
    misleadColors: round >= (rules.misleadColors || Infinity),
    backgroundColor: round >= (rules.backgroundColor || Infinity),
    swapCards: round >= (rules.swapCards || Infinity),
    platformer: round >= (rules.platformer || Infinity),
    glitch: round >= (rules.glitch || Infinity),
    fog: round >= (rules.fog || Infinity),
    ads: round >= (rules.ads || Infinity)
  };
};

window.getEndlessCardCount = function getEndlessCardCount(round) {
  const entry = getEndlessRuleEntry(window.endlessRules.cardCountByRound, round);
  if (!entry || !entry.count) return 3;
  return entry.count;
};

window.getEndlessChallengeOptions = function getEndlessChallengeOptions(round) {
  const modifiers = window.getEndlessModifiers(round);
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
