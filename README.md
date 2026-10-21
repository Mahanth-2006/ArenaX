# ArenaX – Automated Tournament & Matchmaking Engine

A full-stack, 3-tier DBMS application implementing automated tournament creation, team registrations, bracket fixture generation, direct winner advancement, and live standings.

---

## 1. System Architecture & Tech Stack

- **Presentation Tier**: HTML5, Vanilla JavaScript (Fetch API), Tailwind CSS (Frontend integration ready).
- **Application Tier**: Python 3.11+ using FastAPI and `mysql-connector-python` with connection pooling, raw parameterized SQL queries, and atomic transactions.
- **Database Tier**: MySQL 8.0 relational database normalized to Third Normal Form (3NF) with `ON DELETE CASCADE`, `ON DELETE SET NULL`, `CHECK` constraints, and self-referencing binary bracket pointers.

---

## 2. Database Schema (3NF Design)

The database schema is defined in [`backend/schema.sql`](file:///c:/Users/Kanch/Projects/ArenaX/backend/schema.sql) and consists of 6 normalized relational entities:

1. **`users`**: User authentication and roles (`role ENUM('PLAYER', 'ADMIN')`). Passwords hashed with bcrypt.
2. **`teams`**: Team entity created by players (`captain_id FK -> users(id) ON DELETE CASCADE`).
3. **`team_members`**: Junction table for team rosters (`(team_id, user_id)` composite primary key).
4. **`tournaments`**: Tournaments with state tracking (`REGISTRATION_OPEN`, `LOCKED`, `IN_PROGRESS`, `COMPLETED`) and **capacity constraint enforcing even number of teams** (`CHECK (max_teams >= 2 AND max_teams % 2 = 0)`).
5. **`tournament_registrations`**: Junction table for tournament enrollment with unique constraint preventing duplicate registrations (`UNIQUE (tournament_id, team_id)`).
6. **`matches`**: Binary bracket tree matches with self-referencing foreign key (`next_match_id FK -> matches(id) ON DELETE SET NULL`) allowing automatic winner advancement.

---

## 3. Implemented Features

### Feature 1: User Authentication & Role-Based Access Control (RBAC)
- Dual roles: `PLAYER` and `ADMIN`.
- Passwords securely hashed with `bcrypt`.
- Signed JWT access tokens passed via standard Bearer authentication.

### Feature 2: Team Creation & Roster Management
- Logged-in players can create a team and automatically become captain.
- Captains can add and remove members from their roster.
- Roster integrity: deleting a team automatically cascades and cleans up all memberships.

### Feature 3: Admin Tournament Creation & Capacity Management
- Admins can create tournaments with custom titles and any **even number of teams** ($\ge 2$).
- Database strictly rejects non-even numbers via `CHECK` constraints.
- State machine tracking: `REGISTRATION_OPEN` $\rightarrow$ `LOCKED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED`.

### Feature 4: Tournament Browsing & Slot Registration
- Catalog of all active tournaments open for registration.
- Captains can register their team.
- Overbooking protection: verified atomically with `FOR UPDATE` row locks.
- Duplicate protection: prevents duplicate enrollment.

### Feature 5: Automated Bracket Tree Generation & Fixtures
- When a tournament reaches full capacity, it automatically locks and generates the full single-elimination tournament tree.
- Pairs Round 1 fixtures and creates parent matches linked via `next_match_id`.
- Automatically transitions tournament to `IN_PROGRESS`.
- Seamlessly handles both power-of-two tournaments (2, 4, 8, 16) and non-power-of-two even tournaments (6, 10, etc.) with byes.

### Feature 6: Direct Winner Selection & Self-Referencing Advancement
- Admin clicks to select the winning team in active (`READY`) matches without requiring score inputs.
- Marking a winner sets match status to `COMPLETED` and automatically propagates the winning team ID to the parent match referenced by `next_match_id`.
- Once both competitor slots in a parent match are populated, it automatically becomes `READY`.
- Declaring a winner in the final match crowns the tournament champion and sets tournament status to `COMPLETED`.

### Feature 7: Dynamic Tournament Bracket & Standings
- Hierarchical bracket endpoint (`/api/tournaments/{id}/bracket`) grouping matches round-by-round with competitor names, statuses (`PENDING`, `READY`, `COMPLETED`), and parent linkages.

---

## 4. API Endpoints Reference

### Authentication (`/api/auth`)
- `POST /api/auth/signup`: Create Player or Admin account.
- `POST /api/auth/login`: Login and receive JWT access token.
- `GET /api/auth/me`: Get current user profile (requires Bearer token).

### Teams (`/api/teams`)
- `POST /api/teams`: Create team (creator is assigned as captain).
- `GET /api/teams`: List all teams with captain and member counts.
- `GET /api/teams/{id}`: Get team details and roster members.
- `POST /api/teams/{id}/members`: Add player to roster (captain only).
- `DELETE /api/teams/{id}/members/{user_id}`: Remove player from roster (captain only).
- `DELETE /api/teams/{id}`: Delete team (captain or admin).

### Tournaments (`/api/tournaments`)
- `POST /api/tournaments`: Create tournament with even capacity (Admin only).
- `GET /api/tournaments`: List tournaments (optional `?status=REGISTRATION_OPEN`).
- `GET /api/tournaments/{id}`: Get tournament details and registration count.
- `GET /api/tournaments/{id}/registrations`: List registered teams.
- `POST /api/tournaments/{id}/register`: Captain registers team; triggers auto-bracket when full.

### Matches & Bracket (`/api/matches`, `/api/tournaments/{id}/bracket`)
- `GET /api/tournaments/{id}/bracket`: Returns matches grouped by round for rendering tree visualizers.
- `GET /api/matches/{id}`: Get details of a single match.
- `POST /api/matches/{id}/winner`: Admin declares match winner; automatically advances winner to parent match or crowns champion.

---

## 5. Running the Application

### Prerequisites
- Python 3.11+
- MySQL Server 8.0 running locally

### Database Setup
1. MySQL user `arenax` with password `arenax_pass` on database `arenax_db` (or customize `.env`).
2. Run schema:
   ```powershell
   Get-Content backend\schema.sql -Raw | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u arenax -parenax_pass arenax_db
   ```

### Start Backend Server
```powershell
.\backend\.venv\Scripts\uvicorn.exe main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger Documentation: **`http://127.0.0.1:8000/docs`**

### Run Automated Integration Tests
```powershell
.\backend\.venv\Scripts\python.exe test_backend.py
```

### Seed Initial Sample Data
```powershell
.\backend\.venv\Scripts\python.exe backend\seed_data.py
```
Default accounts seeded:
- Admin: `admin` / `admin123`
- Team Captains:
  - `alex` / `alex123` (Team Nova)
  - `ryan` / `ryan123` (Iron Falcons)
  - `kai` / `kai123` (Crimson Vanguard)
  - `neo` / `neo123` (Shadow Wolves)
  - `juno` / `juno123` (Neon Drift)
  - `zane` / `zane123` (Quantum Raiders)
  - `elio` / `elio123` (Solar Flare)
  - `nyx` / `nyx123` (Void Walkers)
- Free Agents:
  - `gabe` / `gabe123`, `hana` / `hana123`, `ivan` / `ivan123`, `jess` / `jess123`
