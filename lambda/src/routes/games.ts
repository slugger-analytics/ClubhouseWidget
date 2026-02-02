import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { Game } from '../types';

const router = Router();

// Get all games with team names
router.get('/', async (req: Request, res: Response) => {
  try {
    const games = await query<Game>(`
      SELECT g.*,
             ht.team_name as home_team_name,
             at.team_name as away_team_name
      FROM clubhouse_games g
      LEFT JOIN clubhouse_teams ht ON g.home_team_id = ht.id
      LEFT JOIN clubhouse_teams at ON g.away_team_id = at.id
      ORDER BY g.date ASC, g.time ASC
    `);
    res.json(games);
  } catch (error: any) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single game by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const game = await queryOne<Game>(`
      SELECT g.*,
             ht.team_name as home_team_name,
             at.team_name as away_team_name
      FROM clubhouse_games g
      LEFT JOIN clubhouse_teams ht ON g.home_team_id = ht.id
      LEFT JOIN clubhouse_teams at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [id]);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (error: any) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get games by date
router.get('/date/:date', async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const games = await query<Game>(`
      SELECT g.*,
             ht.team_name as home_team_name,
             at.team_name as away_team_name
      FROM clubhouse_games g
      LEFT JOIN clubhouse_teams ht ON g.home_team_id = ht.id
      LEFT JOIN clubhouse_teams at ON g.away_team_id = at.id
      WHERE g.date = $1
      ORDER BY g.time ASC
    `, [date]);

    res.json(games);
  } catch (error: any) {
    console.error('Error fetching games by date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get games by team ID (home or away)
router.get('/team/:teamId', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const games = await query<Game>(`
      SELECT g.*,
             ht.team_name as home_team_name,
             at.team_name as away_team_name
      FROM clubhouse_games g
      LEFT JOIN clubhouse_teams ht ON g.home_team_id = ht.id
      LEFT JOIN clubhouse_teams at ON g.away_team_id = at.id
      WHERE g.home_team_id = $1 OR g.away_team_id = $1
      ORDER BY g.date ASC, g.time ASC
    `, [teamId]);

    res.json(games);
  } catch (error: any) {
    console.error('Error fetching games by team:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new game
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { home_team_id, away_team_id, date, time } = req.body;

    if (!home_team_id || !away_team_id) {
      return res.status(400).json({ error: 'home_team_id and away_team_id are required' });
    }

    if (home_team_id === away_team_id) {
      return res.status(400).json({ error: 'home_team_id and away_team_id must be different' });
    }

    // Verify both teams exist
    const homeTeam = await queryOne(`SELECT id FROM clubhouse_teams WHERE id = $1`, [home_team_id]);
    if (!homeTeam) {
      return res.status(404).json({ error: 'Home team not found' });
    }

    const awayTeam = await queryOne(`SELECT id FROM clubhouse_teams WHERE id = $1`, [away_team_id]);
    if (!awayTeam) {
      return res.status(404).json({ error: 'Away team not found' });
    }

    const game = await queryOne<Game>(`
      INSERT INTO clubhouse_games (home_team_id, away_team_id, date, time)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [home_team_id, away_team_id, date, time]);

    res.status(201).json(game);
  } catch (error: any) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a game
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { home_team_id, away_team_id, date, time } = req.body;

    // Validate team IDs if both are provided
    if (home_team_id && away_team_id && home_team_id === away_team_id) {
      return res.status(400).json({ error: 'home_team_id and away_team_id must be different' });
    }

    // Verify teams exist if provided
    if (home_team_id) {
      const team = await queryOne(`SELECT id FROM clubhouse_teams WHERE id = $1`, [home_team_id]);
      if (!team) {
        return res.status(404).json({ error: 'Home team not found' });
      }
    }

    if (away_team_id) {
      const team = await queryOne(`SELECT id FROM clubhouse_teams WHERE id = $1`, [away_team_id]);
      if (!team) {
        return res.status(404).json({ error: 'Away team not found' });
      }
    }

    const game = await queryOne<Game>(`
      UPDATE clubhouse_games
      SET home_team_id = COALESCE($1, home_team_id),
          away_team_id = COALESCE($2, away_team_id),
          date = COALESCE($3, date),
          time = COALESCE($4, time)
      WHERE id = $5
      RETURNING *
    `, [home_team_id, away_team_id, date, time, id]);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (error: any) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a game
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rowCount = await execute(`DELETE FROM clubhouse_games WHERE id = $1`, [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
