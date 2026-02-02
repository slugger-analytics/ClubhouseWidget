"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get all inventory items
router.get('/', async (req, res) => {
    try {
        const inventory = await (0, pool_1.query)(`
      SELECT * FROM clubhouse_inventory
      ORDER BY created_at DESC
    `);
        res.json(inventory);
    }
    catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get current user's team inventory
router.get('/me/team', auth_1.authMiddleware, async (req, res) => {
    try {
        const sluggerUserId = req.user?.cognitoSub;
        if (!sluggerUserId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = await (0, pool_1.queryOne)(`
      SELECT id, team_id FROM clubhouse_users WHERE slugger_user_id = $1
    `, [sluggerUserId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.team_id) {
            return res.json([]);
        }
        const inventory = await (0, pool_1.query)(`
      SELECT * FROM clubhouse_inventory
      WHERE team_id = $1
      ORDER BY created_at DESC
    `, [user.team_id]);
        res.json(inventory);
    }
    catch (error) {
        console.error('Error fetching team inventory:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get inventory by team ID
router.get('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const team = await (0, pool_1.queryOne)(`SELECT id FROM clubhouse_teams WHERE id = $1`, [teamId]);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        const inventory = await (0, pool_1.query)(`
      SELECT * FROM clubhouse_inventory
      WHERE team_id = $1
      ORDER BY created_at DESC
    `, [teamId]);
        res.json(inventory);
    }
    catch (error) {
        console.error('Error fetching inventory by team:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get a single inventory item by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const item = await (0, pool_1.queryOne)(`
      SELECT * FROM clubhouse_inventory WHERE id = $1
    `, [id]);
        if (!item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        res.json(item);
    }
    catch (error) {
        console.error('Error fetching inventory item:', error);
        res.status(500).json({ error: error.message });
    }
});
// Create inventory item for current user's team
router.post('/me/team', auth_1.authMiddleware, async (req, res) => {
    try {
        const sluggerUserId = req.user?.cognitoSub;
        if (!sluggerUserId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = await (0, pool_1.queryOne)(`
      SELECT id, team_id FROM clubhouse_users WHERE slugger_user_id = $1
    `, [sluggerUserId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.team_id) {
            return res.status(400).json({ error: 'User is not assigned to a team' });
        }
        const { meal_id, inventory_type, inventory_item, current_stock, required_stock, unit, purchase_link, note, price_per_unit } = req.body;
        const item = await (0, pool_1.queryOne)(`
      INSERT INTO clubhouse_inventory (
        team_id, meal_id, inventory_type, inventory_item, current_stock,
        required_stock, unit, purchase_link, note, price_per_unit
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [user.team_id, meal_id, inventory_type, inventory_item, current_stock,
            required_stock, unit, purchase_link, note, price_per_unit]);
        res.status(201).json(item);
    }
    catch (error) {
        console.error('Error creating inventory item:', error);
        res.status(500).json({ error: error.message });
    }
});
// Create inventory item for a specific team
router.post('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const team = await (0, pool_1.queryOne)(`SELECT id FROM clubhouse_teams WHERE id = $1`, [teamId]);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        const { meal_id, inventory_type, inventory_item, current_stock, required_stock, unit, purchase_link, note, price_per_unit } = req.body;
        const item = await (0, pool_1.queryOne)(`
      INSERT INTO clubhouse_inventory (
        team_id, meal_id, inventory_type, inventory_item, current_stock,
        required_stock, unit, purchase_link, note, price_per_unit
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [teamId, meal_id, inventory_type, inventory_item, current_stock,
            required_stock, unit, purchase_link, note, price_per_unit]);
        res.status(201).json(item);
    }
    catch (error) {
        console.error('Error creating inventory item:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update an inventory item
router.put('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const sluggerUserId = req.user?.cognitoSub;
        // Verify ownership if authenticated
        if (sluggerUserId) {
            const user = await (0, pool_1.queryOne)(`
        SELECT team_id FROM clubhouse_users WHERE slugger_user_id = $1
      `, [sluggerUserId]);
            if (user && user.team_id) {
                const item = await (0, pool_1.queryOne)(`
          SELECT team_id FROM clubhouse_inventory WHERE id = $1
        `, [id]);
                if (item && item.team_id !== user.team_id) {
                    return res.status(403).json({ error: 'Forbidden: Cannot update inventory from other teams' });
                }
            }
        }
        const { meal_id, inventory_type, inventory_item, current_stock, required_stock, unit, purchase_link, note, price_per_unit } = req.body;
        const item = await (0, pool_1.queryOne)(`
      UPDATE clubhouse_inventory
      SET meal_id = COALESCE($1, meal_id),
          inventory_type = COALESCE($2, inventory_type),
          inventory_item = COALESCE($3, inventory_item),
          current_stock = COALESCE($4, current_stock),
          required_stock = COALESCE($5, required_stock),
          unit = COALESCE($6, unit),
          purchase_link = COALESCE($7, purchase_link),
          note = COALESCE($8, note),
          price_per_unit = COALESCE($9, price_per_unit)
      WHERE id = $10
      RETURNING *
    `, [meal_id, inventory_type, inventory_item, current_stock,
            required_stock, unit, purchase_link, note, price_per_unit, id]);
        if (!item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        res.json(item);
    }
    catch (error) {
        console.error('Error updating inventory item:', error);
        res.status(500).json({ error: error.message });
    }
});
// Delete an inventory item
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const sluggerUserId = req.user?.cognitoSub;
        // Verify ownership if authenticated
        if (sluggerUserId) {
            const user = await (0, pool_1.queryOne)(`
        SELECT team_id FROM clubhouse_users WHERE slugger_user_id = $1
      `, [sluggerUserId]);
            if (user && user.team_id) {
                const item = await (0, pool_1.queryOne)(`
          SELECT team_id FROM clubhouse_inventory WHERE id = $1
        `, [id]);
                if (item && item.team_id !== user.team_id) {
                    return res.status(403).json({ error: 'Forbidden: Cannot delete inventory from other teams' });
                }
            }
        }
        const rowCount = await (0, pool_1.execute)(`DELETE FROM clubhouse_inventory WHERE id = $1`, [id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting inventory item:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=inventory.js.map