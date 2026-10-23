-- ArenaX PostgreSQL Relational Schema (3NF Normalized)
-- Complete Schema for Authentication, Teams, Tournaments, Matches, Notifications & Audit Logs

-- 1. Users Table (Authentication & RBAC)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'PLAYER' CHECK (role IN ('PLAYER', 'ADMIN')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    tag VARCHAR(20),
    captain_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Team Members Junction Table
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('CAPTAIN', 'MEMBER')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_team_user UNIQUE (team_id, user_id)
);

-- 4. Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    capacity INT DEFAULT 4,
    max_teams INT NOT NULL,
    format VARCHAR(50) NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    status VARCHAR(30) NOT NULL DEFAULT 'REGISTRATION_OPEN'
        CHECK (status IN ('REGISTRATION_OPEN', 'LOCKED', 'IN_PROGRESS', 'COMPLETED')),
    organizer_id INT REFERENCES users(id) ON DELETE SET NULL,
    winner_team_id INT REFERENCES teams(id) ON DELETE SET NULL,
    champion_team_id INT REFERENCES teams(id) ON DELETE SET NULL,
    min_team_size INT DEFAULT 2 CHECK (min_team_size >= 1 AND min_team_size <= 5),
    max_team_size INT DEFAULT 5 CHECK (max_team_size >= 1 AND max_team_size <= 5),
    start_date VARCHAR(100),
    registration_deadline VARCHAR(100),
    locked_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_even_teams CHECK (max_teams >= 2 AND max_teams % 2 = 0),
    CONSTRAINT chk_team_size_range CHECK (min_team_size <= max_team_size)
);

-- 5. Tournament Registrations Junction Table
CREATE TABLE IF NOT EXISTS tournament_registrations (
    id SERIAL PRIMARY KEY,
    tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    seed INT,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tourn_team UNIQUE (tournament_id, team_id)
);

-- 6. Matches Table (Self-Referencing Binary Bracket Tree)
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    number INT,
    round INT DEFAULT 1,
    round_number INT NOT NULL DEFAULT 1,
    round_name VARCHAR(50),
    abbr VARCHAR(20),
    match_order INT NOT NULL DEFAULT 1,
    team1_id INT REFERENCES teams(id) ON DELETE SET NULL,
    team2_id INT REFERENCES teams(id) ON DELETE SET NULL,
    winner_id INT REFERENCES teams(id) ON DELETE SET NULL,
    next_match_id INT REFERENCES matches(id) ON DELETE SET NULL,
    next_match_slot INT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'READY', 'IN_PROGRESS', 'COMPLETED')),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'info',
    title VARCHAR(150),
    body TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Audit & Transaction Logging Table
CREATE TABLE IF NOT EXISTS transaction_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(50) DEFAULT 'system',
    statements TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'COMMITTED',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
