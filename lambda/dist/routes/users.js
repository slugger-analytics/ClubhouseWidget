"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await (0, pool_1.query)(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      ORDER BY u.created_at DESC
    `);
        res.json(users);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get current user from JWT token (auto-creates if not found)
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    try {
        const sluggerUserId = req.user?.cognitoSub;
        if (!sluggerUserId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        let user = await (0, pool_1.queryOne)(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.slugger_user_id = $1
    `, [sluggerUserId]);
        // Auto-create user if not found
        if (!user) {
            const userName = req.user?.email || req.user?.username || 'New User';
            user = await (0, pool_1.queryOne)(`
        INSERT INTO clubhouse_users (slugger_user_id, user_name)
        VALUES ($1, $2)
        RETURNING *
      `, [sluggerUserId, userName]);
            console.log(`[Users] Auto-created user for Cognito ID: ${sluggerUserId}`);
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get current user's complete data (user + tasks + inventory, auto-creates if not found)
router.get('/me/complete', auth_1.authMiddleware, async (req, res) => {
    try {
        const sluggerUserId = req.user?.cognitoSub;
        if (!sluggerUserId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        let user = await (0, pool_1.queryOne)(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.slugger_user_id = $1
    `, [sluggerUserId]);
        // Auto-create user if not found
        if (!user) {
            const userName = req.user?.email || req.user?.username || 'New User';
            user = await (0, pool_1.queryOne)(`
        INSERT INTO clubhouse_users (slugger_user_id, user_name)
        VALUES ($1, $2)
        RETURNING *
      `, [sluggerUserId, userName]);
            console.log(`[Users] Auto-created user for Cognito ID: ${sluggerUserId}`);
        }
        // Get user's tasks (empty for new users)
        const tasks = await (0, pool_1.query)(`
      SELECT * FROM clubhouse_tasks
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [user.id]);
        // Get team's inventory if user has a team
        let inventory = [];
        if (user.team_id) {
            inventory = await (0, pool_1.query)(`
        SELECT * FROM clubhouse_inventory
        WHERE team_id = $1
        ORDER BY created_at DESC
      `, [user.team_id]);
        }
        res.json({
            ...user,
            tasks,
            inventory,
        });
    }
    catch (error) {
        console.error('Error fetching complete user data:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await (0, pool_1.queryOne)(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get user by slugger_user_id
router.get('/slugger/:sluggerUserId', async (req, res) => {
    try {
        const { sluggerUserId } = req.params;
        const user = await (0, pool_1.queryOne)(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.slugger_user_id = $1
    `, [sluggerUserId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error fetching user by slugger ID:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get users by team ID
router.get('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const users = await (0, pool_1.query)(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.team_id = $1
      ORDER BY u.created_at DESC
    `, [teamId]);
        res.json(users);
    }
    catch (error) {
        console.error('Error fetching users by team:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get user with complete data by ID
router.get('/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await (0, pool_1.queryOne)(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const tasks = await (0, pool_1.query)(`
      SELECT * FROM clubhouse_tasks
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [id]);
        let inventory = [];
        if (user.team_id) {
            inventory = await (0, pool_1.query)(`
        SELECT * FROM clubhouse_inventory
        WHERE team_id = $1
        ORDER BY created_at DESC
      `, [user.team_id]);
        }
        res.json({
            ...user,
            tasks,
            inventory,
        });
    }
    catch (error) {
        console.error('Error fetching complete user data:', error);
        res.status(500).json({ error: error.message });
    }
});
// Create a new user
router.post('/', async (req, res) => {
    try {
        const { slugger_user_id, user_name, user_role, team_id } = req.body;
        if (!slugger_user_id) {
            return res.status(400).json({ error: 'slugger_user_id is required' });
        }
        const result = await (0, pool_1.queryOne)(`
      INSERT INTO clubhouse_users (slugger_user_id, user_name, user_role, team_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [slugger_user_id, user_name, user_role, team_id]);
        res.status(201).json(result);
    }
    catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update a user
router.put('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { user_name, user_role, team_id } = req.body;
        const result = await (0, pool_1.queryOne)(`
      UPDATE clubhouse_users
      SET user_name = COALESCE($1, user_name),
          user_role = COALESCE($2, user_role),
          team_id = COALESCE($3, team_id)
      WHERE id = $4
      RETURNING *
    `, [user_name, user_role, team_id, id]);
        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result);
    }
    catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: error.message });
    }
});
// Delete a user
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, pool_1.queryOne)(`
      DELETE FROM clubhouse_users WHERE id = $1 RETURNING id
    `, [id]);
        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map