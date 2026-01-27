(() => {
  window.stagesConfig = [
    {
      id: 1,
      name: "Stage 1",
      rounds: 1,
      cards: 10,
      revealSeconds: 8,
      recallSeconds: 10,
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
      starTimes: { gold: 25, silver: 35, bronze: 50 }
    },
    {
      id: 2,
      name: "Stage 2",
      rounds: 4,
      cards: 4,
      revealSeconds: 7,
      recallSeconds: 9,
      categories: ["numbers", "colors"],
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
      starTimes: { gold: 28, silver: 40, bronze: 55 }
    },
    {
      id: 3,
      name: "Stage 3",
      rounds: 5,
      cards: 5,
      revealSeconds: 7,
      recallSeconds: 8,
      categories: ["numbers", "colors", "letters"],
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
      starTimes: { gold: 35, silver: 50, bronze: 70 }
    },
    {
      id: 4,
      name: "Stage 4",
      rounds: 4,
      cards: 4,
      revealSeconds: 7,
      recallSeconds: 9,
      categories: ["numbers", "colors"],
      modifiers: {
        mathOps: false,
        misleadColors: true,
        backgroundColor: false,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { gold: 30, silver: 42, bronze: 58 }
    },
    {
      id: 5,
      name: "Stage 5",
      rounds: 5,
      cards: 5,
      revealSeconds: 7,
      recallSeconds: 8,
      categories: ["numbers", "colors", "letters"],
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
      starTimes: { gold: 35, silver: 50, bronze: 70 }
    },
    {
      id: 6,
      name: "Stage 6",
      rounds: 4,
      cards: 4,
      revealSeconds: 6,
      recallSeconds: 8,
      categories: ["numbers", "colors"],
      modifiers: {
        mathOps: false,
        misleadColors: true,
        backgroundColor: true,
        swapCards: false,
        platformer: false,
        glitch: false,
        fog: false,
        ads: false
      },
      starTimes: { gold: 28, silver: 40, bronze: 55 }
    },
    {
      id: 7,
      name: "Stage 7",
      rounds: 5,
      cards: 6,
      revealSeconds: 7,
      recallSeconds: 8,
      categories: ["numbers", "colors", "letters"],
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
      starTimes: { gold: 36, silver: 52, bronze: 72 }
    },
    {
      id: 8,
      name: "Stage 8",
      rounds: 5,
      cards: 6,
      revealSeconds: 6,
      recallSeconds: 8,
      categories: ["numbers", "colors", "letters", "shapes"],
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
      starTimes: { gold: 38, silver: 54, bronze: 75 }
    },
    {
      id: 9,
      name: "Stage 9",
      rounds: 5,
      cards: 6,
      revealSeconds: 6,
      recallSeconds: 8,
      categories: ["numbers", "colors", "letters", "directions"],
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
      starTimes: { gold: 40, silver: 56, bronze: 78 }
    },
    {
      id: 10,
      name: "Stage 10",
      rounds: 6,
      cards: 6,
      revealSeconds: 6,
      recallSeconds: 7,
      categories: ["numbers", "colors", "letters", "shapes"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: false,
        glitch: true,
        fog: false,
        ads: false
      },
      starTimes: { gold: 42, silver: 60, bronze: 82 }
    },
    {
      id: 11,
      name: "Stage 11",
      rounds: 6,
      cards: 7,
      revealSeconds: 6,
      recallSeconds: 7,
      categories: ["numbers", "colors", "letters", "shapes"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: false,
        glitch: true,
        fog: true,
        ads: false
      },
      starTimes: { gold: 45, silver: 64, bronze: 88 }
    },
    {
      id: 12,
      name: "Stage 12",
      rounds: 6,
      cards: 7,
      revealSeconds: 6,
      recallSeconds: 7,
      categories: ["numbers", "colors", "letters", "directions"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: false,
        glitch: true,
        fog: true,
        ads: false
      },
      starTimes: { gold: 46, silver: 66, bronze: 90 }
    },
    {
      id: 13,
      name: "Stage 13",
      rounds: 6,
      cards: 7,
      revealSeconds: 6,
      recallSeconds: 7,
      categories: ["numbers", "colors", "letters", "shapes", "directions"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: false,
        glitch: true,
        fog: true,
        ads: false
      },
      starTimes: { gold: 48, silver: 68, bronze: 92 }
    },
    {
      id: 14,
      name: "Stage 14",
      rounds: 6,
      cards: 8,
      revealSeconds: 6,
      recallSeconds: 7,
      categories: ["numbers", "colors", "letters", "shapes", "directions"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: false,
        glitch: true,
        fog: true,
        ads: false
      },
      starTimes: { gold: 50, silver: 70, bronze: 95 }
    },
    {
      id: 15,
      name: "Stage 15",
      rounds: 7,
      cards: 8,
      revealSeconds: 6,
      recallSeconds: 7,
      categories: ["numbers", "colors", "letters", "shapes", "directions"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: false,
        glitch: true,
        fog: true,
        ads: false
      },
      starTimes: { gold: 52, silver: 74, bronze: 98 }
    },
    {
      id: 16,
      name: "Stage 16",
      rounds: 7,
      cards: 8,
      revealSeconds: 5,
      recallSeconds: 7,
      categories: ["numbers", "colors", "letters", "shapes", "directions"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: true,
        glitch: true,
        fog: true,
        ads: false
      },
      starTimes: { gold: 55, silver: 78, bronze: 105 }
    },
    {
      id: 17,
      name: "Stage 17",
      rounds: 7,
      cards: 9,
      revealSeconds: 5,
      recallSeconds: 7,
      categories: ["numbers", "colors", "letters", "shapes", "directions"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: true,
        glitch: true,
        fog: true,
        ads: false
      },
      starTimes: { gold: 58, silver: 82, bronze: 110 }
    },
    {
      id: 18,
      name: "Stage 18",
      rounds: 7,
      cards: 9,
      revealSeconds: 5,
      recallSeconds: 6,
      categories: ["numbers", "colors", "letters", "shapes", "directions"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: true,
        glitch: true,
        fog: true,
        ads: false
      },
      starTimes: { gold: 60, silver: 86, bronze: 115 }
    },
    {
      id: 19,
      name: "Stage 19",
      rounds: 8,
      cards: 9,
      revealSeconds: 5,
      recallSeconds: 6,
      categories: ["numbers", "colors", "letters", "shapes", "directions"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: true,
        glitch: true,
        fog: true,
        ads: false
      },
      starTimes: { gold: 62, silver: 90, bronze: 120 }
    },
    {
      id: 20,
      name: "Stage 20",
      rounds: 8,
      cards: 10,
      revealSeconds: 5,
      recallSeconds: 6,
      categories: ["numbers", "colors", "letters", "shapes", "directions"],
      modifiers: {
        mathOps: true,
        misleadColors: true,
        backgroundColor: true,
        swapCards: true,
        platformer: true,
        glitch: true,
        fog: true,
        ads: false
      },
      starTimes: { gold: 65, silver: 95, bronze: 130 }
    }
  ];
})();
