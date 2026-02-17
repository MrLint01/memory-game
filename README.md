# Flash Recall
Flash Recall is a browser-based memory game with progressively challenging rounds, interactive modifiers, and Firebase-backed analytics/storage.

## Live URLs
- Firebase Hosting: https://flash-recall-df7d9.web.app - Not always up
- GitHub Pages: https://mrlint01.github.io/memory-game/

## Project Overview
The app is a static frontend served from the repository root and enhanced with Firebase services.

Core areas include:
- Card-based memory rounds (numbers, colors, letters, directions, shapes)
- Gameplay modifiers in `modifiers/` (for example fog, glitch, swap, ads, platformer)
- UI partials in `ui/`
- Firebase integration for analytics and Firestore access

## Tech Stack
- HTML/CSS/JavaScript (no frontend framework)
- Firebase (Hosting, Firestore, Analytics)

## Repository Structure
- `index.html`: Main application shell
- `style.css`: Styling
- `app.js`, `app-core.js`, `app-game.js`, `app-events.js`: Core runtime/game logic
- `modifiers/`: Modifier modules used during rounds
- `ui/`: Modal and panel partials loaded at runtime
- `firebase.json`: Hosting configuration
- `.firebaserc`: Default Firebase project mapping
- `firestore.rules`: Firestore security rules

## Prerequisites
- Node.js 18+
- npm
- Firebase CLI (`npm install -g firebase-tools`)

### Option A: Firebase Hosting emulator (for testing)
```bash
firebase login
firebase use flash-recall-df7d9
firebase emulators:start --only hosting
```

## Option B: Firebase Hosting
The current hosting config serves from the repository root:
- `firebase.json` -> `"hosting.public": "."`
You may server a different root depending on your file structure

Deploy steps:
```bash
firebase login
firebase use flash-recall-df7d9
firebase deploy --only hosting
```

## Firestore Rules Deployment (not necessary for testing)
Deploy Firestore rules with:
```bash
firebase deploy --only firestore:rules
```

## Common Troubleshooting
- If you see `Firebase Hosting Setup Complete`, verify project and URL:
  - `firebase use`
  - `firebase hosting:sites:list`
  - open the exact URL returned by deploy output
- If a recent deploy is not visible, hard refresh your browser (ctr+r) to bypass cached HTML.
- Check your root of the project for new index.html files. If the json is not working consider running `firebase init`.
