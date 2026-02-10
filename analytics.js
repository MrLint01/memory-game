// analytics.js
// Google Analytics event tracking helpers for Flash Recall

// Track level session with comprehensive stats
function trackLevelSession(stageIndex, stars, elapsedSeconds, entries, attemptNumber) {
  if (!entries || entries.length === 0) return;
  
  const correctCards = entries.filter(e => e.correct);
  const incorrectCards = entries.filter(e => !e.correct);
  const totalCards = entries.length;
  
  // Main level session event with aggregate stats
  gtag('event', 'level_session', {
    level: stageIndex,
    attempt_number: attemptNumber,
    completed: 'true',
    stars_earned: stars,
    time_spent_seconds: elapsedSeconds,
    total_cards: totalCards,
    cards_correct: correctCards.length,
    cards_incorrect: incorrectCards.length,
    success_rate: ((correctCards.length / totalCards) * 100).toFixed(1)
  });
  
  // Send individual card events
  // Correctly guessed cards
  correctCards.forEach((card, index) => {
    gtag('event', 'card_guessed_correctly', {
      level: stageIndex,
      attempt_number: attemptNumber,
      card_category: card.category,
      card_value: card.answer,
      card_position: card.displayIndex,
      time_spent_seconds: elapsedSeconds
    });
  });
  
  // Incorrectly guessed cards
  incorrectCards.forEach((card, index) => {
    gtag('event', 'card_guessed_incorrectly', {
      level: stageIndex,
      attempt_number: attemptNumber,
      card_category: card.category,
      correct_answer: card.answer,
      player_answer: card.userAnswer || 'blank',
      card_position: card.displayIndex,
      time_spent_seconds: elapsedSeconds
    });
  });
}

function trackLevelAttempt(stageIndex, attemptNumber) {
  gtag('event', 'level_attempt', {
    level: stageIndex,
    attempt_number: attemptNumber
  });
}
