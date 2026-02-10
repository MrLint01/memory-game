// analytics.js
// Google Analytics event tracking helpers for Flash Recall

function trackLevelAttempt(stageIndex, attemptNumber) {
  gtag('event', 'level_attempt', {
    stage_index: stageIndex,
    attempt_number: attemptNumber
  });
}

function trackLevelCompleted(stageIndex, stars, elapsedSeconds) {
  gtag('event', 'level_completed', {
    stage_index: stageIndex,
    stars: stars,
    time_seconds: elapsedSeconds
  });
}

function trackLevelCompletionDetails(stageIndex, stars, elapsedSeconds, entries) {
  // Send detailed level completion event including card breakdown
  if (!entries || entries.length === 0) return;
  
  // Find incorrect cards
  const incorrectCards = entries.filter(entry => !entry.correct);
  const correctCards = entries.filter(entry => entry.correct);
  
  // Build card breakdown summary
  const cardTypeStats = {};
  incorrectCards.forEach(card => {
    const category = card.category || 'unknown';
    if (!cardTypeStats[category]) {
      cardTypeStats[category] = [];
    }
    cardTypeStats[category].push({
      correct_answer: card.answer,
      user_answer: card.userAnswer,
      display_index: card.displayIndex
    });
  });
  
  // Send main event with summary data
  gtag('event', 'level_completion_details', {
    stage_index: stageIndex,
    stars: stars,
    time_seconds: elapsedSeconds,
    total_cards: entries.length,
    correct_cards: correctCards.length,
    incorrect_cards: incorrectCards.length,
    difficulty_score: (incorrectCards.length / entries.length * 100).toFixed(2) // percentage of cards missed
  });
  
  // Send detailed events for each incorrect card
  incorrectCards.forEach(card => {
    gtag('event', 'card_missed', {
      stage_index: stageIndex,
      stars: stars,
      time_seconds: elapsedSeconds,
      card_category: card.category,
      correct_answer: card.answer,
      user_answer: card.userAnswer || 'blank',
      card_position: card.displayIndex
    });
  });
}

function trackCardBreakdown(stageIndex, round, cardResults) {
  // cardResults: Array of {cardId, correct, category, answer, userAnswer}
  cardResults.forEach(result => {
    gtag('event', 'card_result', {
      stage_index: stageIndex,
      round: round,
      card_id: result.cardId,
      correct: result.correct,
      category: result.category,
      answer: result.answer,
      user_answer: result.userAnswer
    });
  });
}
