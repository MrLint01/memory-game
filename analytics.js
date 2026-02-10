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
