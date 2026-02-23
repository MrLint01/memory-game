window.sandboxUnlockCosts = {
  cardTypes: {
    numbers: 3,
    letters: 3,
    shapes: 6,
    directions: 9,
    colors: 9,
    diagonal: 15,
    fruits: 100
  },
  modifiers: {
    practiceMathOps: 12,
    practiceMathOpsPlus: 30,
    practiceMisleadColors: 12,
    practiceBackgroundColor: 12,
    practiceTextColor: 12,
    practicePreviousCard: 45,
    practiceSwap: 30,
    practicePlatformer: 100,
    practiceGlitch: 15,
    practiceRotate: 30,
    practiceRotatePlus: 45,
    practiceFog: 30,
    practiceBlur: 45,
    practiceAds: 30
  }
};

(() => {
  const unlockKey = "flashRecallSandboxUnlocks";

  const emptyState = () => ({
    cardTypes: {},
    modifiers: {}
  });

  window.getSandboxUnlockState = function getSandboxUnlockState() {
    try {
      const raw = window.localStorage.getItem(unlockKey);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return emptyState();
      return {
        cardTypes: parsed.cardTypes || {},
        modifiers: parsed.modifiers || {}
      };
    } catch {
      return emptyState();
    }
  };

  window.saveSandboxUnlockState = function saveSandboxUnlockState(state) {
    try {
      window.localStorage.setItem(unlockKey, JSON.stringify(state));
    } catch {
      // ignore
    }
  };

  window.getSandboxStarsEarned = function getSandboxStarsEarned() {
    const stars = window.stageStars || {};
    return Object.values(stars).reduce((sum, value) => sum + (Number(value) || 0), 0);
  };

  window.getSandboxStarsSpent = function getSandboxStarsSpent() {
    const costs = window.sandboxUnlockCosts || { cardTypes: {}, modifiers: {} };
    const state = window.getSandboxUnlockState ? window.getSandboxUnlockState() : emptyState();
    let spent = 0;
    Object.entries(state.cardTypes || {}).forEach(([key, unlocked]) => {
      if (unlocked) {
        spent += Number(costs.cardTypes && costs.cardTypes[key]) || 0;
      }
    });
    Object.entries(state.modifiers || {}).forEach(([key, unlocked]) => {
      if (unlocked) {
        spent += Number(costs.modifiers && costs.modifiers[key]) || 0;
      }
    });
    return spent;
  };

  window.getSandboxStarsAvailable = function getSandboxStarsAvailable() {
    return Math.max(0, window.getSandboxStarsEarned() - window.getSandboxStarsSpent());
  };

  window.isSandboxItemUnlocked = function isSandboxItemUnlocked(type, key) {
    const state = window.getSandboxUnlockState ? window.getSandboxUnlockState() : emptyState();
    if (type === "cardTypes") {
      return Boolean(state.cardTypes && state.cardTypes[key]);
    }
    if (type === "modifiers") {
      return Boolean(state.modifiers && state.modifiers[key]);
    }
    return false;
  };

  window.unlockSandboxItem = function unlockSandboxItem(type, key) {
    const costs = window.sandboxUnlockCosts || { cardTypes: {}, modifiers: {} };
    const state = window.getSandboxUnlockState ? window.getSandboxUnlockState() : emptyState();
    const cost = Number((costs[type] && costs[type][key]) || 0);
    if (type === "cardTypes") {
      if (state.cardTypes[key]) return true;
      if (window.getSandboxStarsAvailable() < cost) return false;
      state.cardTypes[key] = true;
      window.saveSandboxUnlockState(state);
      return true;
    }
    if (type === "modifiers") {
      if (state.modifiers[key]) return true;
      if (window.getSandboxStarsAvailable() < cost) return false;
      state.modifiers[key] = true;
      window.saveSandboxUnlockState(state);
      return true;
    }
    return false;
  };
})();
