(() => {
  window.stagesConfig = [
    {
      id: 1,
      name: "Stage 1",
      rounds: 3,
      cards: 1,
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
      starTimes: { platinum: 4, gold: 5, silver: 8, bronze: 20 },
      instructions: [
        // Round 1 — reveal
        [
          {
            text: "**Memorize** the number.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 2000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 2500,
          }
        ],
        // Round 1 — recall
        [
          {
            text: "Type the number you saw. Type **DIGITS** (e.g., 123).",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 4000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 130,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 4500,
          }
        ],
        // Round 2 — reveal
        [
          {
            text: "Top bar is the **reveal timer**. Memorize before timer runs out.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 4000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 4500,
          }
        ],
        // Round 2 — recall
        [
          {
            text: "Finish before the bar runs out or it **auto-submits**.",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 6000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 130,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 6500,
          }
        ],
        // Round 3 — reveal
        [
          {
            text: "Time tracks how long you spend on the stage. Faster times earn more **STARS**.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
          }
        ],
        // Round 3 — recall
        [
          {
            text: "The round count shows which round you are on in the stage.",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0
          }
        ]
      ]
    },
    {
      id: 2,
      name: "Stage 2",
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
      instructions: [
        // Round 1 — reveal
        [
          {
            text: "**Memorize** the numbers.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 2000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 2500,
          }
        ],
        // Round 1 — recall
        [
          {
            text: "**SHORTCUT:** Press **TAB** to move to the next card.",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 6000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 130,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 6500,
          }
        ],
        // Round 2 — reveal
        [
        ],
        // Round 2 — recall
        [
        ],
        // Round 3 — reveal
        [
        ],
        // Round 3 — recall
        [
        ]
      ],
    },
    {
      id: 3,
      name: "Stage 3",
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
      instructions: [
        // Round 1 — reveal
        [
          {
            text: "**Memorize** the letters.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 2000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 2500,
          }
        ],
        // Round 1 — recall
        [
          {
            text: "Type the letters you saw. **Case-Insensitive**.",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 4000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 130,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 4500,
          }
        ],
        // Round 2 — reveal
        [
        ],
        // Round 2 — recall
        [
        ],
        // Round 3 — reveal
        [
        ],
        // Round 3 — recall
        [
        ]
      ]
    },
    {
      id: 4,
      name: "Stage 4",
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
      instructions: [
        // Round 1 — reveal
        [
          {
            text: "**Memorize** the shapes.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 2000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 2500,
          }
        ],
        // Round 1 — recall
        [
          {
            text: "Type the shapes you saw. **SHORTCUT:** Just **first letters** counts (e.g., **C**ircle -> **C**).",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 6000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 130,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 6500,
          }
        ],
        // Round 2 — reveal
        [
        ],
        // Round 2 — recall
        [
          {
            text: "**C**ircle -> **C**, **T**riangle -> **T**, **S**quare -> **S**",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
          }
        ],
        // Round 3 — reveal
        [
        ],
        // Round 3 — recall
        [
          {
            text: "**C**ircle -> **C**, **T**riangle -> **T**, **S**quare -> **S**",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
          }
        ]
      ]
    },
    {
      id: 6,
      name: "Stage 6",
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
      instructions: [
        // Round 1 — reveal
        [
          {
            text: "**Memorize** the directions.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 2000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 2500,
          }
        ],
        // Round 1 — recall
        [
          {
            text: "Type the directions you saw. **SHORTCUT:** Just **first letters** counts (e.g., **R**ight -> **R**).",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 6000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 130,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 6500,
          }
        ],
        // Round 2 — reveal
        [
        ],
        // Round 2 — recall
        [
          {
            text: "**R**ight -> **R**, **L**eft -> **L**, **U**p -> **U**, **D**own -> **D**",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
          }
        ],
        // Round 3 — reveal
        [
        ],
        // Round 3 — recall
        [
          {
            text: "**R**ight -> **R**, **L**eft -> **L**, **U**p -> **U**, **D**own -> **D**",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
          }
        ]
      ]
    },
    {
      id: 7,
      name: "Stage 7",
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
      instructions: [
        // Round 1 — reveal
        [
          {
            text: "**Memorize** the colors.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 2000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 2500,
          }
        ],
        // Round 1 — recall
        [
          {
            text: "Type the colors you saw. **SHORTCUT:** Just **first letter** counts (e.g., **R**ed -> **R**).",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 6000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 130,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 6500,
          }
        ],
        // Round 2 — reveal
        [
        ],
        // Round 2 — recall
        [
          {
            text: "**R**ed -> **R**, **B**lue -> **B**, **G**reen -> **G**, **Y**ellow -> **Y**, ...",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
          }
        ],
        // Round 3 — reveal
        [
        ],
        // Round 3 — recall
        [
          {
            text: "**R**ed -> **R**, **B**lue -> **B**, **G**reen -> **G**, **Y**ellow -> **Y**, ...",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
          }
        ]
      ]
    },
    {
      id: 8,
      name: "Stage 8",
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
      instructions: [
        // Round 1 — reveal
        [
          {
            text: "**Memorize** the number.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 2000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 2500,
          }
        ],
        // Round 1 — recall
        [
          {
            text: "Apply the **Math Operation** on the card to its corresponding number.",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 6000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 130,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 6500,
          }
        ]
      ]
    },
    {
      id: 12,
      name: "Stage 12",
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
      rounds: 3,
      cards: 3,
      revealSeconds: 15,
      recallSeconds: 15,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
      modifiers: {
        mathOps: true,
      },
      starTimes: { platinum: 4, gold: 8, silver: 12, bronze: 20 }
    },
    {
      id: 14,
      name: "Stage 14",
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
      instructions: [
        // Round 1 — reveal
        [
          {
            text: "**Memorize** the **BACKGROUND Colors**.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 2000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 2500,
          }
        ],
        // Round 1 — recall
        [
          {
            text: "Type the background colors you saw. **SHORTCUT:** Just **first letter** counts (e.g., **R**ed -> **R**).",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 6000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 130,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 6500,
          }
        ]
      ]
    },
    {
      id: 16,
      name: "Stage 16",
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
      rounds: 2,
      cards: 3,
      revealSeconds: 30,
      recallSeconds: 30,
      categories: ["numbers", "colors", "letters", "directions", "shapes"],
      modifiers: {
        backgroundColor: true,
        backgroundColorChance: 1.0,
        backgroundPromptChance: 0.5
      },
      starTimes: { platinum: 10, gold: 16, silver: 20, bronze: 30 }
    },
    {
      id: 20,
      name: "Stage 20",
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
      instructions: [
        // Round 1 — reveal
        [
          {
            text: "**Memorize** the **COLOR TEXT** (NOT BACKGROUND).",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 2000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 140,
            w: 80,
            h: 0.82,
            size: "2rem",
            color: "#111827",
            at: 2500,
          }
        ],
        // Round 1 — recall
        [
          {
            text: "Type the **Color Text* you saw. **SHORTCUT:** Just **first letter** counts (e.g., **R**ed -> **R**).",
            x: 0,
            y: 130,
            w: 100,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 0,
            duration: 6000
          },
          {
            text: "Press **RETURN/ENTER** when ready.",
            x: 0.1,
            y: 130,
            w: 80,
            h: 0.7,
            size: "2rem",
            color: "#111827",
            at: 6500,
          }
        ]
      ]
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
