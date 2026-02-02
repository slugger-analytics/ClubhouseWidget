"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get all meals
router.get('/', async (req, res) => {
    try {
        const meals = await (0, pool_1.query)(`
      SELECT * FROM clubhouse_meals
      ORDER BY created_at DESC
    `);
        res.json(meals);
    }
    catch (error) {
        console.error('Error fetching meals:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get meal by game ID
router.get('/game/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = await (0, pool_1.queryOne)(`SELECT id FROM clubhouse_games WHERE id = $1`, [gameId]);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        const meal = await (0, pool_1.queryOne)(`
      SELECT * FROM clubhouse_meals WHERE game_id = $1
    `, [gameId]);
        if (!meal) {
            return res.status(404).json({ error: 'Meal not found for this game' });
        }
        res.json(meal);
    }
    catch (error) {
        console.error('Error fetching meal by game:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get a single meal by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const meal = await (0, pool_1.queryOne)(`
      SELECT * FROM clubhouse_meals WHERE id = $1
    `, [id]);
        if (!meal) {
            return res.status(404).json({ error: 'Meal not found' });
        }
        res.json(meal);
    }
    catch (error) {
        console.error('Error fetching meal:', error);
        res.status(500).json({ error: error.message });
    }
});
// Create or update meal for a game (upsert)
router.put('/game/:gameId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { gameId } = req.params;
        const { pre_game_snack, post_game_meal } = req.body;
        const game = await (0, pool_1.queryOne)(`SELECT id FROM clubhouse_games WHERE id = $1`, [gameId]);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Try to update existing meal, or insert new one
        const meal = await (0, pool_1.queryOne)(`
      INSERT INTO clubhouse_meals (game_id, pre_game_snack, post_game_meal)
      VALUES ($1, $2, $3)
      ON CONFLICT (game_id) DO UPDATE
      SET pre_game_snack = COALESCE($2, clubhouse_meals.pre_game_snack),
          post_game_meal = COALESCE($3, clubhouse_meals.post_game_meal)
      RETURNING *
    `, [gameId, pre_game_snack, post_game_meal]);
        res.json(meal);
    }
    catch (error) {
        // If ON CONFLICT doesn't work (no unique constraint), try update then insert
        try {
            const { gameId } = req.params;
            const { pre_game_snack, post_game_meal } = req.body;
            const existingMeal = await (0, pool_1.queryOne)(`
        SELECT * FROM clubhouse_meals WHERE game_id = $1
      `, [gameId]);
            if (existingMeal) {
                const meal = await (0, pool_1.queryOne)(`
          UPDATE clubhouse_meals
          SET pre_game_snack = COALESCE($1, pre_game_snack),
              post_game_meal = COALESCE($2, post_game_meal)
          WHERE game_id = $3
          RETURNING *
        `, [pre_game_snack, post_game_meal, gameId]);
                return res.json(meal);
            }
            else {
                const meal = await (0, pool_1.queryOne)(`
          INSERT INTO clubhouse_meals (game_id, pre_game_snack, post_game_meal)
          VALUES ($1, $2, $3)
          RETURNING *
        `, [gameId, pre_game_snack, post_game_meal]);
                return res.status(201).json(meal);
            }
        }
        catch (innerError) {
            console.error('Error upserting meal:', innerError);
            res.status(500).json({ error: innerError.message });
        }
    }
});
// Create a new meal
router.post('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const { game_id, pre_game_snack, post_game_meal } = req.body;
        if (!game_id) {
            return res.status(400).json({ error: 'game_id is required' });
        }
        const game = await (0, pool_1.queryOne)(`SELECT id FROM clubhouse_games WHERE id = $1`, [game_id]);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        const meal = await (0, pool_1.queryOne)(`
      INSERT INTO clubhouse_meals (game_id, pre_game_snack, post_game_meal)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [game_id, pre_game_snack, post_game_meal]);
        res.status(201).json(meal);
    }
    catch (error) {
        console.error('Error creating meal:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update a meal
router.put('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { pre_game_snack, post_game_meal } = req.body;
        const meal = await (0, pool_1.queryOne)(`
      UPDATE clubhouse_meals
      SET pre_game_snack = COALESCE($1, pre_game_snack),
          post_game_meal = COALESCE($2, post_game_meal)
      WHERE id = $3
      RETURNING *
    `, [pre_game_snack, post_game_meal, id]);
        if (!meal) {
            return res.status(404).json({ error: 'Meal not found' });
        }
        res.json(meal);
    }
    catch (error) {
        console.error('Error updating meal:', error);
        res.status(500).json({ error: error.message });
    }
});
// Delete a meal
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const rowCount = await (0, pool_1.execute)(`DELETE FROM clubhouse_meals WHERE id = $1`, [id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Meal not found' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting meal:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=meals.js.map