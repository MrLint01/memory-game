(() => {
  window.stagesConfig = [
    {
      id: 1,
      name: "Stage 1",
      rounds: 3,
      cards: 1,
      revealSeconds: 6,
      recallSeconds: 15,
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
      starTimes: { gold: 12, silver: 20, bronze: 30 }
    },
    {
      id: 2,
      name: "Stage 2",
      rounds: 3,
      cards: 4,
      revealSeconds: 6,
      recallSeconds: 15,
      categories: ["numbers"],
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
      starTimes: { gold: 12, silver: 20, bronze: 30 }
    },
    {
      id: 3,
      name: "Stage 3",
      rounds: 3,
      cards: 4,
      revealSeconds: 5,
      recallSeconds: 15,
      categories: ["numbers", "letters"],
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
      starTimes: { gold: 10, silver: 15, bronze: 25 }
    },
    {
      id: 4,
      name: "Stage 4",
      rounds: 3,
      cards: 4,
      revealSeconds: 5,
      recallSeconds: 15,
      categories: ["numbers", "letters", "directions"],
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
      starTimes: { gold: 10, silver: 15, bronze: 25 }
    },
    {
      id: 5,
      name: "Stage 5",
      rounds: 3,
      cards: 4,
      revealSeconds: 5,
      recallSeconds: 15,
      categories: ["numbers", "letters", "directions", "shapes"],
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
      starTimes: { gold: 10, silver: 15, bronze: 25 }
    },
    {
      id: 6,
      name: "Stage 6",
      rounds: 3,
      cards: 4,
      revealSeconds: 5,
      recallSeconds: 15,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
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
      starTimes: { gold: 10, silver: 15, bronze: 25 }
    },
    {
      id: 7,
      name: "Stage 7",
      rounds: 3,
      cards: 4,
      revealSeconds: 5,
      recallSeconds: 15,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
      modifiers: {
        mathOps: true,
        misleadColors: false,
        backgroundColor: true,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { gold: 10, silver: 15, bronze: 25 }
    },
    {
      id: 8,
      name: "Stage 8",
      rounds: 3,
      cards: 4,
      revealSeconds: 5,
      recallSeconds: 15,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { gold: 10, silver: 15, bronze: 25 }
    },
    {
      id: 9,
      name: "Stage 9",
      rounds: 3,
      cards: 4,
      revealSeconds: 5,
      recallSeconds: 15,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { gold: 10, silver: 15, bronze: 25 }
    },
    {
      id: 10,
      name: "Stage 10",
      rounds: 3,
      cards: 6,
      revealSeconds: 5,
      recallSeconds: 10,
      categories: ["numbers", "colors", "letters", "shapes", "directions"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: false,
        platformer: false,
        glitch: true,
        fog: false,
        ads: false
      },
      starTimes: { gold: 10, silver: 15, bronze: 30 }
    },
  ];
})();
