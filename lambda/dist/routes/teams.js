"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get all teams
router.get('/', async (req, res) => {
    try {
        const teams = await (0, pool_1.query)(`
      SELECT * FROM clubhouse_teams
      ORDER BY team_name ASC
    `);
        res.json(teams);
    }
    catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get a single team by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const team = await (0, pool_1.queryOne)(`
      SELECT * FROM clubhouse_teams WHERE id = $1
    `, [id]);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.json(team);
    }
    catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ error: error.message });
    }
});
// Create a new team
router.post('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const { team_name, slugger_team_id } = req.body;
        if (!team_name) {
            return res.status(400).json({ error: 'team_name is required' });
        }
        const team = await (0, pool_1.queryOne)(`
      INSERT INTO clubhouse_teams (team_name, slugger_team_id)
      VALUES ($1, $2)
      RETURNING *
    `, [team_name, slugger_team_id]);
        res.status(201).json(team);
    }
    catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update a team
router.put('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { team_name, slugger_team_id } = req.body;
        const team = await (0, pool_1.queryOne)(`
      UPDATE clubhouse_teams
      SET team_name = COALESCE($1, team_name),
          slugger_team_id = COALESCE($2, slugger_team_id)
      WHERE id = $3
      RETURNING *
    `, [team_name, slugger_team_id, id]);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.json(team);
    }
    catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({ error: error.message });
    }
});
// Delete a team
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const rowCount = await (0, pool_1.execute)(`DELETE FROM clubhouse_teams WHERE id = $1`, [id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=teams.js.map