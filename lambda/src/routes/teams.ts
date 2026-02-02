import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { Team } from '../types';

const router = Router();

// Get all teams
router.get('/', async (req: Request, res: Response) => {
  try {
    const teams = await query<Team>(`
      SELECT * FROM clubhouse_teams
      ORDER BY team_name ASC
    `);
    res.json(teams);
  } catch (error: any) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single team by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const team = await queryOne<Team>(`
      SELECT * FROM clubhouse_teams WHERE id = $1
    `, [id]);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team);
  } catch (error: any) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new team
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { team_name, slugger_team_id } = req.body;

    if (!team_name) {
      return res.status(400).json({ error: 'team_name is required' });
    }

    const team = await queryOne<Team>(`
      INSERT INTO clubhouse_teams (team_name, slugger_team_id)
      VALUES ($1, $2)
      RETURNING *
    `, [team_name, slugger_team_id]);

    res.status(201).json(team);
  } catch (error: any) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a team
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { team_name, slugger_team_id } = req.body;

    const team = await queryOne<Team>(`
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
  } catch (error: any) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a team
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rowCount = await execute(`DELETE FROM clubhouse_teams WHERE id = $1`, [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
