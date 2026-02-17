// Firebase Analytics for Flash Recall
// Handles all Firestore tracking for level attempts, rounds, and card failures

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC9Wqa3tvKDcM1yPuCgjRkwtM_xbsMmLQg",
  authDomain: "flash-recall-df7d9.firebaseapp.com",
  projectId: "flash-recall-df7d9",
  storageBucket: "flash-recall-df7d9.firebasestorage.app",
  messagingSenderId: "84239074574",
  appId: "1:84239074574:web:265f87be6b4b9df8ccc35f"
};

let firebaseApp = null;
let firebaseDb = null;
let currentUserId = null;
let currentSessionId = null;
let roundsForCurrentLevel = [];

// Initialize Firebase and Firestore
async function initializeFirebase() {
  try {
    // Initialize Firebase app
    firebaseApp = firebase.initializeApp(firebaseConfig);
    firebaseDb = firebase.firestore();
    
    // Set up anonymous authentication
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        currentUserId = user.uid;
        console.log('Firebase anonymous user authenticated:', currentUserId);
        await createNewSession();
      } else {
        // Sign in anonymously if not already
        try {
          await firebase.auth().signInAnonymously();
        } catch (error) {
          console.error('Failed to sign in anonymously:', error);
        }
      }
    });
  } catch (error) {
    console.error('Firebase initialization failed:', error);
  }
}

// Create a new gaming session on app start
async function createNewSession() {
  try {
    const sessionRef = await firebaseDb.collection('game_sessions').add({
      user_id: currentUserId,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      total_playtime_seconds: 0
    });
    currentSessionId = sessionRef.id;
    console.log('New session created:', currentSessionId);
  } catch (error) {
    console.error('Failed to create session:', error);
  }
}

// Track round completion
function trackRoundCompletion(roundNumber, passed, timeSpent) {
  roundsForCurrentLevel.push({
    round_number: roundNumber,
    passed: passed,
    time_spent: parseFloat(timeSpent.toFixed(2))
  });
}

// Main level tracking - sent when level completes/fails/quits
async function trackLevelSession(levelNumber, passed, stars, elapsedSeconds, entries) {
  if (!entries || entries.length === 0) {
    console.warn('trackLevelSession called with empty entries');
    return;
  }
  
  if (!currentSessionId || !currentUserId) {
    console.warn('Firebase not initialized yet');
    return;
  }

  try {
    const failedCards = entries
      .filter(e => !e.correct)
      .map(card => ({
        card_type: card.category || 'unknown',
        expected: card.answer || card.expected || 'unknown',
        actual: card.userAnswer || card.actual || 'blank',
        position: card.displayIndex || 0
      }));

    // Create the level attempt document
    const attemptData = {
      user_id: currentUserId,
      level_number: levelNumber,
      passed: passed,
      stars: stars || 0,
      time_seconds: parseFloat(elapsedSeconds.toFixed(2)),
      rounds: roundsForCurrentLevel,
      cards_failed: failedCards,
      total_cards: entries.length,
      cards_failed_count: failedCards.length,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Store in Firestore under the current session
    await firebaseDb
      .collection('game_sessions')
      .doc(currentSessionId)
      .collection('attempts')
      .add(attemptData);

    console.log('Level attempt tracked:', {
      level: levelNumber,
      passed: passed,
      rounds: roundsForCurrentLevel.length,
      failedCards: failedCards.length
    });

    // Reset rounds for next level
    roundsForCurrentLevel = [];
  } catch (error) {
    console.error('Failed to track level session:', error);
  }
}

// Track session end with total time
async function trackSessionEnd(totalSessionSeconds, lastLevelCompleted) {
  if (!currentSessionId) {
    console.warn('No active session to end');
    return;
  }

  try {
    await firebaseDb
      .collection('game_sessions')
      .doc(currentSessionId)
      .update({
        total_playtime_seconds: parseFloat(totalSessionSeconds.toFixed(2)),
        last_level_completed: lastLevelCompleted || 0,
        ended_at: firebase.firestore.FieldValue.serverTimestamp()
      });

    console.log('Session ended:', {
      sessionId: currentSessionId,
      totalTime: totalSessionSeconds,
      lastLevel: lastLevelCompleted
    });
  } catch (error) {
    console.error('Failed to track session end:', error);
  }
}

// Initialize Firebase when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
  initializeFirebase();
}

