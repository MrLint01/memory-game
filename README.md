# Flash Recall

Flash Recall is a browser-based memory game with progressive difficulty, gameplay modifiers, unlockable achievements, stage variants, and Firestore-backed telemetry.

## Live URLs
- Firebase Hosting: https://flash-recall-df7d9.web.app
- GitHub Pages: https://mrlint01.github.io/memory-game/

## Current Release
- App version: `2026.04.0`
- Content reset version: `2026.04.0-stage-reset-1`
- Global progress leaderboard version: tied to the content reset version

## Tech Stack
- HTML, CSS, JavaScript
- Firebase Hosting
- Firestore
- Python + pandas + matplotlib for offline analysis

## Repository Structure
- `index.html`: main app shell
- `app.js`, `app-core.js`, `app-game.js`, `app-events.js`: gameplay and UI runtime
- `firebase-analytics.js`: telemetry, achievements, Firestore sync, leaderboards
- `settings-defaults.js`: settings defaults
- `stages-data.js`, `stages-mode.js`, `stages-instructions.js`: stage content and stage-select flow
- `style.css`: game styling and theme definitions
- `version.js`: release, channel, and reset metadata
- `firestore.rules`: Firestore security rules
- `package-site.ps1`: builds a zip with `index.html` at archive root
- `scripts/export_firestore_logs.py`: export Firestore logs
- `scripts/prepare_log_exports.py`: convert exports to CSVs
- `scripts/analyze_logs.py`: generate charts and summaries
- `scripts/compare_release_versions.py`: compare multiple releases

## Prerequisites
- Node.js 18+
- Firebase CLI
- Python 3.10+

## Firebase Setup
```bash
npm install -g firebase-tools
firebase login
firebase use flash-recall-df7d9
```

## Local Run
```bash
firebase emulators:start --only hosting
```

## Deploy
### Hosting
```bash
firebase deploy --only hosting
```

### Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### Full Deploy
```bash
firebase deploy --only hosting,firestore:rules
```

## Packaging
Build the standard publish set:
- `dist/crazygames-small`
- `dist/crazygames-large`
- `gamejolt-small.zip`
- `gamejolt-large.zip`
- `dist/flash-recall-small.zip`
- `dist/flash-recall-large.zip`

The small build is also copied to the compatibility paths:
- `dist/crazygames`
- `gamejolt.zip`
- `dist/flash-recall.zip`

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\package-site.ps1
```

Optional one-off zip output:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\package-site.ps1 -Variant large -OutputPath .\dist\flash-recall-custom.zip
```

## Versioning
`version.js` publishes:
- `window.FLASH_RECALL_VERSION`
- `window.FLASH_RECALL_RELEASE_CHANNEL`
- `window.FLASH_RECALL_BUILD_ID`
- `window.FLASH_RECALL_CONTENT_RESET_VERSION`
- `window.FLASH_RECALL_PROGRESS_LEADERBOARD_VERSION`

Update `version` and reset metadata before releases that change leaderboard or progression compatibility.

## Firestore Data Model
Telemetry is written under:
- `game_sessions/{sessionDoc}`
- `game_sessions/{sessionDoc}/attempts/{attempt}`
- `game_sessions/{sessionDoc}/events/{event}`

Stage leaderboards are written under:
- `leaderboards/stage_{stageId}/versions/v{stageVersion}/entries/{playerId}`

Global progress leaderboards are written under:
- `leaderboards_global/progress/versions/{resetVersion}/entries/{authUid}`

Achievement state is written under:
- `achievement_profiles/{playerId}`
- `achievements_global/summary`
- `achievements_global/summary/entries/{achievementId}`

## Logging and Analytics
Telemetry currently captures:
- stable browser `player_id`
- authenticated Firebase anonymous `auth_uid`
- session lifecycle and active playtime
- fullscreen usage duration
- level, round, and attempt events
- quit context and inactivity inference
- settings usage and current settings state
- home menu, stats, achievements, and leaderboard interactions
- adaptive difficulty group assignment (`undecided`, `A`, `B`)
- autoplay vs manual progression for splash, preview, and next-level flows

This data supports retention, feature-usage, quit-location, and adaptive-group comparison graphs.

## Export and Analysis
Install Python dependencies:

```bash
pip install google-cloud-firestore pandas matplotlib
```

### Step 1: Export Firestore Data
Keep the service account key out of git.

```bash
python scripts/export_firestore_logs.py ^
  --service-account C:\keys\flash-recall-service-account.json ^
  --out data_combined.json
```

Optional sample export:

```bash
python scripts/export_firestore_logs.py ^
  --service-account C:\keys\flash-recall-service-account.json ^
  --out data_combined_sample.json ^
  --limit 100
```

### Step 2: Prepare CSVs
```bash
python scripts/prepare_log_exports.py ^
  --combined data_combined.json ^
  --outdir prepared_data
```

Outputs:
- `prepared_data/sessions.csv`
- `prepared_data/attempts.csv`
- `prepared_data/events.csv`

### Step 3: Analyze
```bash
python scripts/analyze_logs.py ^
  --sessions prepared_data/sessions.csv ^
  --attempts prepared_data/attempts.csv ^
  --events prepared_data/events.csv ^
  --outdir analysis_output
```

Useful options:
- `--version-filter <version>`
- `--extra-version <version>`

Comparison helper:

```bash
python scripts/compare_release_versions.py
```

## Troubleshooting
- If Firestore writes fail with `Missing or insufficient permissions`, deploy both the latest app code and rules:
  - `firebase deploy --only hosting,firestore:rules`
- If stats leaderboards do not update after a reset, confirm the client and Firestore rules both use:
  - `leaderboards_global/progress/versions/{resetVersion}/entries/{authUid}`
- If Firebase Hosting works but GitHub Pages does not, the GitHub Pages copy is stale and must be updated separately.
- If deploy changes do not appear, hard refresh or test in an incognito window.
- `favicon.ico` 404s are cosmetic unless you explicitly want a favicon.

## Safety
- Do not commit service account keys.
- If a key is exposed, rotate or delete it immediately.
