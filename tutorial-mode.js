window.tutorialSteps = [
  {
    type: "cards",
    message: "Remember these numbers. When ready, press Enter, then type them below.",
    messagePosition: { x: "50%", y: "7rem", center: true },
    recallMessage: "Enter the numbers you saw. Press Tab to go to the next answer box.",
    recallMessagePosition: { x: "50%", y: "6rem", center: true },
    cards: [
      { category: "numbers", label: "1" },
      { category: "numbers", label: "2" },
      { category: "numbers", label: "3" }
    ],
    timed: false
  },
  {
    type: "cards",
    message: "Remember these letters. When ready, press Enter, then type them below.",
    messagePosition: { x: "50%", y: "7rem", center: true },
    recallMessage: "Enter the letters you saw. Inputs are case-insensitive (A and a are both correct). Press Tab to go to the next answer box.",
    recallMessagePosition: { x: "50%", y: "2rem", center: true },
    cards: [
      { category: "letters", label: "A" },
      { category: "letters", label: "B" },
      { category: "letters", label: "C" }
    ],
    timed: false
  },
  {
    type: "cards",
    message: "Remember these colors:\nYou can type the full color name or just the first letter.\nFor example: Red -> R, Blue -> B.\nWhen ready, press Enter.",
    messagePosition: { x: "50%", y: "4rem", center: true },
    recallMessage: "Enter the colors you saw.",
    recallMessagePosition: { x: "50%", y: "5.3rem", center: true },
    cards: [
      { category: "colors", label: "Red" },
      { category: "colors", label: "Blue" },
      { category: "colors", label: "Green" }
    ],
    timed: false
  },
  {
    type: "cards",
    message:
      "Background colors:\nUse the background color of each card.\nType the color name or the first letter.\nWhen ready, press Enter. Don't be misled by incorrect color names.",
    messagePosition: { x: "50%", y: "4rem", center: true },
    recallMessage: "Enter the background colors you saw.",
    recallMessagePosition: { x: "50%", y: "5.3rem", center: true },
    cards: [
      {
        category: "colors",
        label: "3",
        backgroundColorHex: "#ef4444",
        recallHint: "Background color",
        answer: "Red"
      },
      {
        category: "colors",
        label: "H",
        backgroundColorHex: "#3b82f6",
        recallHint: "Background color",
        answer: "Blue"
      },
      {
        category: "colors",
        label: "Purple",
        backgroundColorHex: "#22c55e",
        recallHint: "Background color",
        answer: "Green"
      }
    ],
    timed: false
  },
  {
    type: "cards",
    message: "Directions:\nYou can type the full direction or just the first letter.\nFor example: Right -> R, Left -> L.\nWhen ready, press Enter.",
    messagePosition: { x: "50%", y: "4.5rem", center: true },
    recallMessage: "Enter the directions you saw.",
    recallMessagePosition: { x: "50%", y: "5.3rem", center: true },
    cards: [
      { category: "directions", label: "Right" },
      { category: "directions", label: "Left" }
    ],
    timed: false
  },
  {
    type: "cards",
    message: "Shapes:\nYou can type the full shape name or just the first letter.\nFor example: Square -> S, Triangle -> T.\nWhen ready, press Enter.",
    messagePosition: { x: "50%", y: "4rem", center: true },
    recallMessage: "Enter the directions and shapes you saw.",
    recallMessagePosition: { x: "50%", y: "5.3rem", center: true },
    cards: [
      { category: "shapes", label: "Square" },
      { category: "shapes", label: "Triangle" }
    ],
    timed: false
  },
  {
    type: "cards",
    message:
      "Math operations can appear on number cards.\nExamples: + 2, - 1, * 2. Solve the math and enter the result.",
    messagePosition: { x: "50%", y: "7rem", center: true },
    recallMessage: "Solve the operations and enter the answers.",
    recallMessagePosition: { x: "50%", y: "6rem", center: true },
    cards: [
      { category: "numbers", label: "4", mathOp: true }
    ],
    timed: false
  },
  {
    type: "prompt",
    message: "Are you ready? Press Enter to start the final test.",
    messagePosition: { x: "50%", y: "5.3rem", center: true },
    timed: false
  },
  {
    type: "cards",
    message: "Final test. Timed recall. Press Enter to skip timer.",
    messagePosition: { x: "50%", y: "5.3rem", center: true },
    recallMessage: "Final test: enter everything you saw.",
    recallMessagePosition: { x: "50%", y: "5.3rem", center: true },
    cards: [
      { category: "numbers", label: "7" },
      { category: "colors", label: "Blue" },
      { category: "directions", label: "Up" },
      { category: "shapes", label: "Circle" }
    ],
    timed: true,
    revealSeconds: 20,
    recallSeconds: 20
  }
];

window.getTutorialStep = function getTutorialStep(index) {
  if (!Array.isArray(window.tutorialSteps)) return null;
  return window.tutorialSteps[index] || null;
};

window.getTutorialStepCount = function getTutorialStepCount() {
  if (!Array.isArray(window.tutorialSteps)) return 0;
  return window.tutorialSteps.length;
};
