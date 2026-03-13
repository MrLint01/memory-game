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
        2: { cards: { total: 1, counts: { letters: 1 } } },
        3: { cards: { total: 1, counts: { shapes: 1 } } }
      },
      modifiers: {},
      starTimes: { platinum: 1.5, gold: 3, silver: 10, bronze: 20 },
      instructions: window.stageInstructionsB ? window.stageInstructionsB[1] || [] : []
    },
    {
      id: 2,
      version: 1,
      name: "Stage 2",
      stageType: "tutorial",
      rounds: 3,
      cards: 1,
      noRepeatAcrossRounds: true,
      tabTutorialEnabled: false,
      revealSeconds: 10,
      recallSeconds: 30,
      categories: ["directions", "colors", "diagonal"],
      cardCounts: {},
      roundOverrides: {
        1: { cards: { total: 1, counts: { directions: 1 } } },
        2: { cards: { total: 1, counts: { colors: 1 } } },
        3: { cards: { total: 1, counts: { diagonal: 1 } } }
      },
      modifiers: {},
      starTimes: { platinum: 1.5, gold: 3, silver: 10, bronze: 20 },
      instructions: window.stageInstructionsB ? window.stageInstructionsB[2] || [] : []
    },
    {
      id: 3,
      version: 1,
      name: "Stage 3",
      stageType: "tutorial",
      rounds: 2,
      cards: 2,
      noRepeatAcrossRounds: true,
      tabTutorialEnabled: true,
      revealSeconds: 5,
      recallSeconds: 30,
      categories: ["numbers", "letters"],
      cardCounts: {},
      roundOverrides: {
        1: { cards: { total: 2, counts: { numbers: 1, letters: 1 } } },
        2: { cards: { total: 2, counts: { numbers: 1, letters: 1 } } }
      },
      modifiers: {},
      starTimes: { platinum: 1.5, gold: 3, silver: 10, bronze: 20 },
      instructions: window.stageInstructionsB ? window.stageInstructionsB[3] || [] : []
    }
  ];
  window.stagesConfigB = stagesConfigB;
})();
