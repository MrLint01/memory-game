// analytics.js
// Google Analytics event tracking for Flash Recall
// Data structure:
// - Attempted level
//   - level_number (int)
//   - passed (bool)
//   - stars (int)
//   - time (float) - total time for level
//   - rounds (array)
//     - round_number (int)
//     - passed (bool)
//     - time_spent (float)
//   - cards_failed (array)
//     - expected (string)
//     - actual (string)
// - Time per session (float)
// - Last level completed when quitting (int)

// Accumulate rounds data for current level
let roundsForCurrentLevel = [];

// Track round completion - call this when each round within a level finishes
function trackRoundCompletion(roundNumber, passed, timeSpent) {
  roundsForCurrentLevel.push({
    round_number: roundNumber,
    passed: passed,
    time_spent: parseFloat(timeSpent.toFixed(2))
  });
}

// Main level tracking - sent when level completes
function trackLevelSession(levelNumber, passed, stars, elapsedSeconds, entries) {
  if (!entries || entries.length === 0) return;
  
  const failedCards = entries.filter(e => !e.correct).map(card => ({
    card_type: card.category || 'unknown',
    expected: card.answer || card.expected || 'unknown',
    actual: card.userAnswer || card.actual || 'blank'
  }));
  
  // Main attempted level event with nested rounds and failed cards
  gtag('event', 'attempted_level', {
    level_number: levelNumber,
    passed: passed ? 'true' : 'false',
    stars: stars,
    time: parseFloat(elapsedSeconds.toFixed(2)),
    rounds: JSON.stringify(roundsForCurrentLevel),
    cards_failed: JSON.stringify(failedCards),
    total_cards: entries.length,
    cards_failed_count: failedCards.length
  });
  
  // Reset rounds for next level
  roundsForCurrentLevel = [];
}

// Track session end with total time and last completed level
function trackSessionEnd(totalSessionSeconds, lastLevelCompleted) {
  gtag('event', 'session_end', {
    time_per_session_seconds: parseFloat(totalSessionSeconds.toFixed(2)),
    last_level_completed: lastLevelCompleted
  });
}
