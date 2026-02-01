import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { User } from '../types';

const router = Router();

// Get all users
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await query<User>(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user from JWT token
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sluggerUserId = req.user?.cognitoSub;
    if (!sluggerUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await queryOne<User>(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.slugger_user_id = $1
    `, [sluggerUserId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user's complete data (user + tasks + inventory)
router.get('/me/complete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sluggerUserId = req.user?.cognitoSub;
    if (!sluggerUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await queryOne<User>(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.slugger_user_id = $1
    `, [sluggerUserId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's tasks
    const tasks = await query(`
      SELECT * FROM clubhouse_tasks
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [user.id]);

    // Get team's inventory if user has a team
    let inventory: any[] = [];
    if (user.team_id) {
      inventory = await query(`
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
  } catch (error: any) {
    console.error('Error fetching complete user data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await queryOne<User>(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by slugger_user_id
router.get('/slugger/:sluggerUserId', async (req: Request, res: Response) => {
  try {
    const { sluggerUserId } = req.params;
    const user = await queryOne<User>(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.slugger_user_id = $1
    `, [sluggerUserId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user by slugger ID:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get users by team ID
router.get('/team/:teamId', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const users = await query<User>(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.team_id = $1
      ORDER BY u.created_at DESC
    `, [teamId]);

    res.json(users);
  } catch (error: any) {
    console.error('Error fetching users by team:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user with complete data by ID
router.get('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await queryOne<User>(`
      SELECT u.*, t.team_name
      FROM clubhouse_users u
      LEFT JOIN clubhouse_teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tasks = await query(`
      SELECT * FROM clubhouse_tasks
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [id]);

    let inventory: any[] = [];
    if (user.team_id) {
      inventory = await query(`
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
  } catch (error: any) {
    console.error('Error fetching complete user data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new user
router.post('/', async (req: Request, res: Response) => {
  try {
    const { slugger_user_id, user_name, user_role, team_id } = req.body;

    if (!slugger_user_id) {
      return res.status(400).json({ error: 'slugger_user_id is required' });
    }

    const result = await queryOne<User>(`
      INSERT INTO clubhouse_users (slugger_user_id, user_name, user_role, team_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [slugger_user_id, user_name, user_role, team_id]);

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a user
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_name, user_role, team_id } = req.body;

    const result = await queryOne<User>(`
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
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a user
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await queryOne(`
      DELETE FROM clubhouse_users WHERE id = $1 RETURNING id
    `, [id]);

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
