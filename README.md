# Flash Recall

Flash Recall is a browser-based memory game with progressive difficulty, gameplay modifiers, and Firestore-backed telemetry for analysis.

## Live URLs
- Firebase Hosting: https://flash-recall-df7d9.web.app
- GitHub Pages: https://mrlint01.github.io/memory-game/

## Tech Stack
- HTML, CSS, JavaScript (framework-free frontend)
- Firebase Hosting
- Firestore for telemetry storage
- Python + pandas + matplotlib for offline analytics

## Repository Structure
- `index.html`: Main app shell
- `app.js`, `app-core.js`, `app-game.js`, `app-events.js`: Game/runtime logic
- `firebase-analytics.js`: Firestore telemetry pipeline
- `version.js`: Build/version metadata surfaced to telemetry
- `firestore.rules`: Firestore security rules
- `scripts/export_firestore_logs.py`: Export Firestore logs to combined JSON
- `scripts/prepare_log_exports.py`: Convert exports into analysis-ready CSVs
- `scripts/analyze_logs.py`: Analyze logs and generate charts

## Prerequisites
- Node.js 18+
- npm
- Firebase CLI (`npm install -g firebase-tools`)
- Python 3.10+

## Firebase Setup
```bash
npm install -g firebase-tools
firebase login
firebase use flash-recall-df7d9
```

## Local Run (Hosting Emulator)
```bash
firebase emulators:start --only hosting
```

## Deploy
### Hosting
Hosting serves from repo root (`firebase.json` -> `"hosting.public": "."`).

```bash
firebase deploy --only hosting
```

### Firestore Rules
Deploy rules when `firestore.rules` changes.

```bash
firebase deploy --only firestore
```

## Logging Model
Telemetry captures:
- Stable `player_id` per browser (`localStorage`)
- New `session_id` for each app return/session
- Session start/end timestamps and total duration
- `level_start`, `level_end`, `round_complete`
- Tab/window lifecycle (`tab_hidden`, `tab_visible`, `window_focus`, `window_blur`, `page_hide`, `before_unload`)
- Inactivity quit inference (`quit_inferred_inactivity`)
- Game version + release channel on events

Data is written under:
- `game_sessions/{sessionDoc}`
- `game_sessions/{sessionDoc}/attempts/{attempt}`
- `game_sessions/{sessionDoc}/events/{event}`

## Versioning
`version.js` controls release metadata:
- `window.FLASH_RECALL_VERSION`
- `window.FLASH_RECALL_RELEASE_CHANNEL`
- `window.FLASH_RECALL_BUILD_ID`

Update the `version` constant before each release.

## Data Export + Analysis
Install dependencies:
```bash
pip install google-cloud-firestore pandas matplotlib
```

### Step 1: Export from Firestore
Create a Firebase service account key in Firebase Console and keep it out of git.
I have also included exlusions in the git ignore, but just make sure the key is never public.

```bash
python scripts/export_firestore_logs.py \
  --service-account C:\\keys\\flash-recall-service-account.json \
  --out data_combined.json
```

Optional test export:
```bash
python scripts/export_firestore_logs.py \
  --service-account C:\\keys\\flash-recall-service-account.json \
  --out data_combined_sample.json \
  --limit 100
```

### Step 2: Prepare CSVs
```bash
python scripts/prepare_log_exports.py \
  --combined data_combined.json \
  --outdir prepared_data
```

This writes:
- `prepared_data/sessions.csv`
- `prepared_data/attempts.csv`
- `prepared_data/events.csv`

### Step 3: Analyze
```bash
python scripts/analyze_logs.py \
  --sessions prepared_data/sessions.csv \
  --attempts prepared_data/attempts.csv \
  --events prepared_data/events.csv \
  --outdir analysis_output
```

Outputs include:
- `analysis_output/summary.txt`
- `analysis_output/session_duration_hist.png`
- `analysis_output/completion_by_level.png`
- `analysis_output/dropoff_by_level.png`
- `analysis_output/event_volume_by_type.png`

## Service Account Key Safety
- Do not commit service account keys.
- Keep key files outside the repo (recommended), e.g. `C:\keys\...json`.
- If a key was ever committed, rotate/delete it immediately in Google Cloud.

## Troubleshooting
- If you see `Firebase Hosting Setup Complete`, verify project/site and open the exact deployed URL.
- If Hosting deploy fails on Spark with executable-file errors, check `firebase.json` ignore patterns and ensure `.git/**` and `.venv/**` are excluded.
- If telemetry fails with `Missing or insufficient permissions`, deploy rules with `firebase deploy --only firestore`.
- If deploy changes do not appear, hard refresh or use an incognito window.
