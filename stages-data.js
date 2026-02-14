(() => {
  window.stagesConfig = [
    {
      id: 1,
      name: "Stage 1",
      stageType: "tutorial",
      rounds: 3,
      cards: 1,
      revealSeconds: 30,
      recallSeconds: 30,
      categories: ["numbers"],
      cardCounts: {},
      modifiers: {
        mathOps: true,
        mathChance: 0.7,
        mathMinCount: null,
        mathMaxCount: null,
        misleadColors: true,
        misleadChance: 0.6,
        misleadMinCount: null,
        misleadMaxCount: null,
        backgroundColor: true,
        backgroundColorChance: 0.35,
        backgroundPromptChance: 0.5,
        backgroundPromptMinCount: null,
        backgroundPromptMaxCount: null,
        swapCards: true,
        swapChance: 1,
        platformer: true,
        glitch: true,
        fog: true,
        ads: true
      },
      starTimes: { platinum: 2, gold: 5, silver: 8, bronze: 20 },
      instructions: window.stageInstructions[1] || []
    },
    {
      id: 2,
      name: "Stage 2",
      stageType: "tutorial",
      rounds: 3,
      cards: 2,
      revealSeconds: 30,
      recallSeconds: 30,
      categories: ["numbers"],
      modifiers: {
        mathOps: false,
        misleadColors: false,
        backgroundColor: false,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { platinum: 3, gold: 10, silver: 16, bronze: 30 },
      instructions: window.stageInstructions[2] || [],
    },
    {
      id: 3,
      name: "Stage 3",
      stageType: "tutorial",
      rounds: 3,
      cards: 2,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["letters"],
      modifiers: {
        mathOps: true,
        misleadColors: false,
        backgroundColor: false,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { platinum: 3, gold: 8, silver: 12, bronze: 20 },
      instructions: window.stageInstructions[3] || []
    },
    {
      id: 4,
      name: "Stage 4",
      stageType: "memory",
      rounds: 3,
      cards: 2,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers", "letters"],
      modifiers: {
        mathOps: false,
        misleadColors: false,
        backgroundColor: false,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { platinum: 3, gold: 6.5, silver: 12, bronze: 20 },
    },
    {
      id: 5,
      name: "Stage 5",
      stageType: "tutorial",
      rounds: 3,
      cards: 1,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["shapes"],
      modifiers: {
        mathOps: false,
        misleadColors: false,
        backgroundColor: false,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { platinum: 2, gold: 6, silver: 10, bronze: 20 },
      instructions: window.stageInstructions[5] || []
    },
    {
      id: 6,
      name: "Stage 6",
      stageType: "tutorial",
      rounds: 3,
      cards: 1,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["directions"],
      modifiers: {
        mathOps: true,
        misleadColors: false,
        backgroundColor: false,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { platinum: 2.5, gold: 6.5, silver: 12, bronze: 20 },
      instructions: window.stageInstructions[6] || []
    },
    {
      id: 7,
      name: "Stage 7",
      stageType: "tutorial",
      rounds: 3,
      cards: 1,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["colors"],
      modifiers: {
        mathOps: false,
        misleadColors: false,
        backgroundColor: false,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { platinum: 2, gold: 6, silver: 10, bronze: 20 },
      instructions: window.stageInstructions[7] || []
    },
    {
      id: 8,
      name: "Stage 8",
      stageType: "memory",
      rounds: 3,
      cards: 2,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers", "directions", "shapes"],
      modifiers: {
        mathOps: false,
        misleadColors: false,
        backgroundColor: false,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { platinum: 3, gold: 5, silver: 10, bronze: 20 },
    },
    {
      id: 9,
      name: "Stage 9",
      stageType: "memory",
      rounds: 3,
      cards: 2,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers", "colors", "letters"],
      modifiers: {
        mathOps: false,
        misleadColors: false,
        backgroundColor: false,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { platinum: 3, gold: 5, silver: 10, bronze: 20 },
    },
    {
      id: 10,
      name: "Stage 10",
      stageType: "memory",
      rounds: 2,
      cards: 3,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers", "colors", "letters", "shapes", "directions"],
      modifiers: {
      },
      starTimes: { platinum: 3.5, gold: 8, silver: 12, bronze: 20 }
    },
    {
      id: 11,
      name: "Stage 11",
      stageType: "tutorial",
      rounds: 3,
      cards: 1,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers"],
      modifiers: {
        mathOps: true,
        mathChance: 1.0,
      },
      starTimes: { platinum: 4, gold: 8, silver: 12, bronze: 20 },
      instructions: window.stageInstructions[11] || []
    },
    {
      id: 12,
      name: "Stage 12",
      stageType: "memory",
      rounds: 3,
      cards: 2,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers"],
      modifiers: {
        mathOps: true,
        mathChance: 0.7, //default
      },
      starTimes: { platinum: 4, gold: 8, silver: 12, bronze: 20 }
    },
    {
      id: 13,
      name: "Stage 13",
      stageType: "memory",
      rounds: 3,
      cards: 3,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
      modifiers: {
        mathOps: true
      },
      starTimes: { platinum: 4, gold: 8, silver: 12, bronze: 20 }
    },
    {
      id: 14,
      name: "Stage 14",
      stageType: "memory",
      rounds: 1,
      cards: 4,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
      modifiers: {
        mathOps: true,
      },
      starTimes: { platinum: 4, gold: 8, silver: 12, bronze: 20 }
    },
    {
      id: 15,
      name: "Stage 15",
      stageType: "tutorial",
      rounds: 3,
      cards: 2,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers"],
      modifiers: {
        backgroundColor: true,
        backgroundColorChance: 1.0,
        backgroundPromptChance: 1.0,
      },
      starTimes: { platinum: 4, gold: 8, silver: 12, bronze: 20 },
      instructions: window.stageInstructions[15] || []
    },
    {
      id: 16,
      name: "Stage 16",
      stageType: "memory",
      rounds: 4,
      cards: 1,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers", "letters", "shapes"],
      modifiers: {
        backgroundColor: true,
        backgroundColorChance: 1.0,
        backgroundPromptChance: 0.5
      },
      starTimes: { platinum: 4, gold: 8, silver: 12, bronze: 20 }
    },
    {
      id: 17,
      name: "Stage 17",
      stageType: "memory",
      rounds: 2,
      cards: 2,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
      modifiers: {
        backgroundColor: true,
        backgroundColorChance: 1.0,
        backgroundPromptChance: 0.5
      },
      starTimes: { platinum: 4, gold: 8, silver: 12, bronze: 20 }
    },
    {
      id: 18,
      name: "Stage 18",
      stageType: "memory",
      rounds: 1,
      cards: 3,
      revealSeconds: 30,
      recallSeconds: 30,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
      modifiers: {
        backgroundColor: true,
        backgroundColorChance: 1.0,
        backgroundPromptChance: 0.5
      },
      starTimes: { platinum: 5, gold: 8, silver: 12, bronze: 20 }
    },
    {
      id: 19,
      name: "Stage 19",
      stageType: "memory",
      rounds: 2,
      cards: 3,
      revealSeconds: 30,
      recallSeconds: 30,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
      modifiers: {
        backgroundColor: true,
        backgroundColorChance: 0.7,
        backgroundPromptChance: 0.5,
        mathOps: true
      },
      starTimes: { platinum: 10, gold: 16, silver: 20, bronze: 30 }
    },
    {
      id: 20,
      name: "Stage 20",
      stageType: "tutorial",
      rounds: 3,
      cards: 2,
      revealSeconds: 30,
      recallSeconds: 30,
      categories: ["colors"],
      modifiers: {
        misleadColors: true,
        misleadChance: 1.0
      },
      starTimes: { platinum: 3, gold: 10, silver: 15, bronze: 20 },
      instructions: window.stageInstructions[20] || []
    },
  ];
})();


  // mathOps: true,
  // mathChance: 0.9,
  // misleadColors: true,
  // misleadChance: 0.4,
  // backgroundColor: true,
  // backgroundColorChance: 1.0,
  // backgroundPromptChance: 0.5
  // swapCards: true,
  // swapChance: 0.3,
  // platformer: false,
  // glitch: false,
  // fog: false,
  // ads: false
