# ArenaX — Frontend

Automated tournament management & matchmaking engine · DBMS mini-project.
Modern esports-platform UI built with **HTML5 + Tailwind (CDN) + vanilla JS** — no frameworks.

## Run it

Any static file server works (the mock backend lives in the browser):

```bash
cd frontend
python3 -m http.server 5500
# → open http://localhost:5500
```

> Opening `index.html` directly via `file://` also works for the demo,
> but a local server is recommended (some browsers restrict storage on file://).

## Demo accounts (seeded)

| Role   | Username | Password   | Notes                        |
| ------ | -------- | ---------- | ---------------------------- |
| ADMIN  | `admin`  | `admin123` | full Control Center          |
| PLAYER | `alex`   | `alex123`  | captain of **Team Nova**     |
| PLAYER | `ryan`   | `ryan123`  | captain of **Iron Falcons**  |

Every seeded captain can log in with `<username>123` (e.g. `kai/kai123` for Crimson Vanguard).
"Reset demo data" on the login screen (and in admin flows) restores the original seed.

## The 60-second professor demo

1. **Login as `admin`** → Create Tournament → *"VIT Inter-College Championship"*, capacity **8**
   (live bracket preview shows 4 QF → 2 SF → 1 F, 7 match rows).
2. Tournament shows **REGISTRATION OPEN · 0/8**.
3. Log out, log in as captains (`alex`, `ryan`, `kai`, `neo`, `juno`, `zane`, `elio`, `nyx`)
   and register each team — capacity bar climbs **6/8 → 7/8 → 8/8**.
4. At **8/8** the engine automatically **LOCKS** the tournament and **generates the bracket**
   in the same transaction (visible in the Database Lens tx log).
5. Log back in as `admin` → open the bracket → click a **READY** match → **Select winner** →
   confirm. Watch the winner **fly into the parent match** (propagation via `next_match_id`).
6. Repeat through the final → 🏆 **COMPLETED** screen with champion, confetti and final bracket.
7. Check **History** and the **Database Lens** (ERD row counts + transaction log).

## Architecture

```
frontend/
├── index.html        landing + login/register (player & admin)
├── dashboard.html    player dashboard + tournament discovery (?tab=tournaments)
├── team.html         my team: creation, roster composition, add/remove members
├── tournament.html   tournament details: overview | bracket (?id=…&tab=…)
├── admin.html        admin control center (?view=overview|create|tournaments|manage|matches|users|teams)
├── history.html      completed tournaments + final brackets
├── css/style.css     design system: tokens, bracket, timeline, DB-lens, motion
└── js/
    ├── api.js        ★ centralized API layer — the ONLY module doing I/O
    ├── mock.js       dev-only mock backend (simulated MySQL: tables, constraints,
    │                 state machines, transactions with SQL logs). Nothing else imports it.
    ├── auth.js       session, RBAC guards, "Access Restricted" screen, landing logic
    ├── ui.js         toasts, modals, badges, progress, skeletons, empty/error states,
    │                 navbar, admin shell, lifecycle timeline, Database Lens, animations
    ├── bracket.js    ★ interactive bracket renderer + winner-selection flow
    ├── dashboard.js  player dashboard + discovery
    ├── team.js       roster management
    ├── tournament.js tournament details / bracket / champion screen
    ├── admin.js      all admin views
    └── history.js    tournament history
```

### Connecting the real FastAPI backend

1. Implement the routes documented at the top of each function in `js/api.js`
   (`POST /auth/login`, `POST /tournaments/:id/register`, `POST /matches/:id/winner`, …).
   The mock server in `js/mock.js` implements exactly the same paths, payload shapes
   and error contract (`{ error: { code, message, fields } }`), so it doubles as API documentation.
2. Set `USE_MOCK = false` in `js/api.js` (or open any page with `?mock=0`).
3. Keep `API_BASE_URL = "http://localhost:8000/api"` pointing at the server.

Nothing else changes — the frontend only renders state returned by the API and
sends user actions; all progression logic (locking, bracket generation, winner
propagation, status transitions) belongs to the backend/database.

### DBMS concepts surfaced in the UI

| Concept                        | Where it shows up                                                        |
| ------------------------------ | ------------------------------------------------------------------------ |
| CHECK capacity ∈ (4,8,16)      | create-tournament capacity cards, tournament info chips                  |
| Capacity constraint            | "6 / 8 REGISTERED" fractions + animated progress bars everywhere         |
| UNIQUE(tournament_id, team_id) | duplicate-registration error toast + confirmation-modal SQL              |
| State machine (tournament)     | 4-step lifecycle timeline on manage/details pages                        |
| State machine (match)          | PENDING / READY / COMPLETED badges on every match card                   |
| Self-referencing FK            | bracket connector wires + "winner → Match #5" footers + fly animation    |
| Transactions / atomicity       | Database Lens tx log (BEGIN…COMMIT/ROLLBACK with statements), confirm modals |
| Normalized relationships       | Database Lens ERD with live row counts                                   |
| Captain auto-membership        | team creation modal explains the two-INSERT transaction                  |
