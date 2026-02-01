-- ClubhouseWidget Data Migration from Supabase
-- Run this AFTER 001_initial_schema.sql
-- 
-- Data exported from Supabase project: esmuegorbzltpkpmnxzu
-- Export date: 2026-02-01

-- ============================================================================
-- TEAMS DATA (10 rows)
-- ============================================================================
INSERT INTO clubhouse_teams (id, team_name, created_at) OVERRIDING SYSTEM VALUE VALUES
(1, 'Lancaster Stormers', '2025-11-29T19:26:30.287131+00:00'),
(2, 'Long Island Ducks', '2025-11-29T19:26:30.287131+00:00'),
(3, 'York Revolution', '2025-11-29T19:26:30.287131+00:00'),
(4, 'Staten Island Ferry Hawks', '2025-11-29T19:26:30.287131+00:00'),
(5, 'Hagerstown Flying Boxcars', '2025-11-29T19:26:30.287131+00:00'),
(6, 'Gastonia Flying Boxcars', '2025-11-29T19:26:30.287131+00:00'),
(7, 'High Point Rockers', '2025-11-29T19:26:30.287131+00:00'),
(8, 'Lexington Legends', '2025-11-29T19:26:30.287131+00:00'),
(9, 'Southern Maryland Blue Crabs', '2025-11-29T19:26:30.287131+00:00'),
(10, 'Charleston Dirty Birds', '2025-11-29T19:26:30.287131+00:00');

-- Reset sequence
SELECT setval('clubhouse_teams_id_seq', (SELECT MAX(id) FROM clubhouse_teams));

-- ============================================================================
-- USERS DATA (1 row)
-- ============================================================================
INSERT INTO clubhouse_users (id, slugger_user_id, user_name, user_role, team_id, created_at) OVERRIDING SYSTEM VALUE VALUES
(2, 'test_user_1', 'Test User', 'Clubhouse Manager', 1, '2025-11-29T20:01:58.452943+00:00');

-- Reset sequence
SELECT setval('clubhouse_users_id_seq', (SELECT MAX(id) FROM clubhouse_users));

-- ============================================================================
-- TASKS DATA (17 rows) - Sample shown, full data in JSON export
-- ============================================================================
-- Note: Tasks reference user_id=2 which maps to the test user above
-- Full task data should be imported from task_data.json

-- ============================================================================
-- GAMES DATA (1132 rows)
-- ============================================================================
-- Note: Games data is large (1132 rows). Import from games_data.json using:
-- \copy clubhouse_games FROM 'games_data.csv' WITH CSV HEADER;
-- Or use a data migration script

-- ============================================================================
-- MEALS DATA (1132 rows)
-- ============================================================================
-- Note: Meals data is large (1132 rows). Import from meals_data.json using:
-- \copy clubhouse_meals FROM 'meals_data.csv' WITH CSV HEADER;
-- Or use a data migration script

-- ============================================================================
-- INVENTORY DATA (1 row)
-- ============================================================================
INSERT INTO clubhouse_inventory (id, team_id, meal_id, inventory_type, inventory_item, current_stock, required_stock, unit, purchase_link, note, price_per_unit, created_at) OVERRIDING SYSTEM VALUE VALUES
(14, 1, NULL, 'Laundry & Cleaning', 'Laundry Detergent', 3, 3, 'unit', 'https://www.amazon.com/Amazon-Basics-Concentrated-Detergent-Lavender/dp/B09CLS6DYH', NULL, 7.00, '2025-12-11T21:57:41.045044+00:00');

-- Reset sequence
SELECT setval('clubhouse_inventory_id_seq', (SELECT MAX(id) FROM clubhouse_inventory));
