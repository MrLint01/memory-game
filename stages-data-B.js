(() => {
  const stagesConfigB = [
    {
      id: 1,
      version: 1,
      name: "Stage 1",
      stageType: "tutorial",
      rounds: 3,
      cards: 1,
      noRepeatAcrossRounds: true,
      tabTutorialEnabled: false,
      revealSeconds: 10,
      recallSeconds: 30,
      categories: ["numbers", "letters", "shapes"],
      cardCounts: {},
      roundOverrides: {
        1: { cards: { total: 1, counts: { numbers: 1 } } },
        2: { cards: { total: 2, counts: { letters: 2 } } },
        3: { cards: { total: 2, counts: { shapes: 2 } } }
      },
      modifiers: {},
      starTimes: { platinum: 1.5, gold: 3, silver: 10, bronze: 20 },
      instructions: window.stageInstructionsB ? window.stageInstructionsB[1] || [] : []
    }
  ];
  window.stagesConfigB = stagesConfigB;
  if (Array.isArray(window.stagesConfig) && window.stagesConfig.length) {
    const byId = new Map(stagesConfigB.map((stage) => [stage.id, stage]));
    window.stagesConfig = window.stagesConfig.map((stage) =>
      byId.has(stage.id) ? byId.get(stage.id) : stage
    );
  } else {
    window.stagesConfig = stagesConfigB;
  }
})();
