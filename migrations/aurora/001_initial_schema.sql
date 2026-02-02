-- ClubhouseWidget Aurora Migration Schema
-- Migrated from Supabase to AWS Aurora PostgreSQL
-- Created: 2026-02-01
-- 
-- This schema creates clubhouse_* prefixed tables to avoid conflicts
-- with existing SLUGGER tables in the shared Aurora database.

-- ============================================================================
-- TEAMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS clubhouse_teams (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    team_name TEXT NOT NULL,
    slugger_team_id INTEGER, -- Optional FK to SLUGGER teams.team_id
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubhouse_teams_slugger_team_id 
    ON clubhouse_teams(slugger_team_id);

-- ============================================================================
-- USERS TABLE
-- Links to SLUGGER users via slugger_user_id -> users.cognito_user
-- ============================================================================
CREATE TABLE IF NOT EXISTS clubhouse_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slugger_user_id TEXT NOT NULL UNIQUE, -- FK to SLUGGER users.cognito_user
    user_name TEXT,
    user_role TEXT,
    team_id BIGINT REFERENCES clubhouse_teams(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubhouse_users_slugger_user_id 
    ON clubhouse_users(slugger_user_id);
CREATE INDEX IF NOT EXISTS idx_clubhouse_users_team_id 
    ON clubhouse_users(team_id);

-- ============================================================================
-- TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS clubhouse_tasks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES clubhouse_users(id) ON DELETE CASCADE,
    task_name TEXT,
    task_description TEXT,
    task_complete BOOLEAN DEFAULT FALSE,
    task_category TEXT, -- 'Medical & Safety', 'Equipment & Field Support', etc.
    task_type INTEGER,
    task_date DATE,
    task_time TIME,
    is_repeating BOOLEAN DEFAULT FALSE,
    repeating_day INTEGER, -- Day of week (0-6)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubhouse_tasks_user_id 
    ON clubhouse_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_clubhouse_tasks_task_date 
    ON clubhouse_tasks(task_date);

-- ============================================================================
-- GAMES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS clubhouse_games (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    home_team_id BIGINT NOT NULL REFERENCES clubhouse_teams(id) ON DELETE CASCADE,
    away_team_id BIGINT NOT NULL REFERENCES clubhouse_teams(id) ON DELETE CASCADE,
    date DATE,
    time TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT clubhouse_games_different_teams CHECK (home_team_id != away_team_id)
);

CREATE INDEX IF NOT EXISTS idx_clubhouse_games_home_team_id 
    ON clubhouse_games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_clubhouse_games_away_team_id 
    ON clubhouse_games(away_team_id);
CREATE INDEX IF NOT EXISTS idx_clubhouse_games_date 
    ON clubhouse_games(date);

-- ============================================================================
-- MEALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS clubhouse_meals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    game_id BIGINT NOT NULL REFERENCES clubhouse_games(id) ON DELETE CASCADE,
    pre_game_snack TEXT,
    post_game_meal TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubhouse_meals_game_id 
    ON clubhouse_meals(game_id);

-- ============================================================================
-- INVENTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS clubhouse_inventory (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    team_id BIGINT REFERENCES clubhouse_teams(id) ON DELETE CASCADE,
    meal_id BIGINT REFERENCES clubhouse_meals(id) ON DELETE SET NULL,
    inventory_type TEXT, -- Category like 'Laundry & Cleaning', 'Medical & Safety'
    inventory_item TEXT,
    current_stock INTEGER,
    required_stock INTEGER,
    unit TEXT,
    purchase_link TEXT,
    note TEXT,
    price_per_unit NUMERIC(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubhouse_inventory_team_id 
    ON clubhouse_inventory(team_id);
CREATE INDEX IF NOT EXISTS idx_clubhouse_inventory_meal_id 
    ON clubhouse_inventory(meal_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE clubhouse_teams IS 'ClubhouseWidget teams - may link to SLUGGER teams';
COMMENT ON TABLE clubhouse_users IS 'ClubhouseWidget users - links to SLUGGER via slugger_user_id';
COMMENT ON TABLE clubhouse_tasks IS 'Clubhouse manager daily tasks';
COMMENT ON TABLE clubhouse_games IS 'Game schedule for meal planning';
COMMENT ON TABLE clubhouse_meals IS 'Pre/post game meal planning per game';
COMMENT ON TABLE clubhouse_inventory IS 'Team inventory tracking';
