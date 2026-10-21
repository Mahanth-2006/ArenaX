-- ArenaX Database Schema

CREATE DATABASE IF NOT EXISTS arenax_db;
USE arenax_db;

-- 1. Users Table (Authentication & RBAC)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('PLAYER', 'ADMIN') NOT NULL DEFAULT 'PLAYER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    captain_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_teams_captain FOREIGN KEY (captain_id) 
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Team Members Junction Table (Many-to-Many: Users <-> Teams)
CREATE TABLE IF NOT EXISTS team_members (
    team_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id),
    CONSTRAINT fk_tm_team FOREIGN KEY (team_id) 
        REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_tm_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tournaments Table
-- Capacity must be an even number >= 2
CREATE TABLE IF NOT EXISTS tournaments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    max_teams INT NOT NULL,
    status ENUM('REGISTRATION_OPEN', 'LOCKED', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'REGISTRATION_OPEN',
    winner_team_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_even_teams CHECK (max_teams >= 2 AND max_teams % 2 = 0),
    CONSTRAINT fk_tourn_winner FOREIGN KEY (winner_team_id) 
        REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tournament Registrations Junction Table (Many-to-Many: Teams <-> Tournaments)
CREATE TABLE IF NOT EXISTS tournament_registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    team_id INT NOT NULL,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tourn_team UNIQUE (tournament_id, team_id),
    CONSTRAINT fk_tr_tournament FOREIGN KEY (tournament_id) 
        REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT fk_tr_team FOREIGN KEY (team_id) 
        REFERENCES teams(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Matches Table (Self-Referencing Binary Bracket Tree)
CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    round_number INT NOT NULL,
    match_order INT NOT NULL,
    team1_id INT DEFAULT NULL,
    team2_id INT DEFAULT NULL,
    winner_id INT DEFAULT NULL,
    next_match_id INT DEFAULT NULL,
    status ENUM('PENDING', 'READY', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_match_tourn FOREIGN KEY (tournament_id) 
        REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT fk_match_t1 FOREIGN KEY (team1_id) 
        REFERENCES teams(id) ON DELETE SET NULL,
    CONSTRAINT fk_match_t2 FOREIGN KEY (team2_id) 
        REFERENCES teams(id) ON DELETE SET NULL,
    CONSTRAINT fk_match_winner FOREIGN KEY (winner_id) 
        REFERENCES teams(id) ON DELETE SET NULL,
    CONSTRAINT fk_match_next FOREIGN KEY (next_match_id) 
        REFERENCES matches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
