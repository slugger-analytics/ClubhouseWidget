import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { Task } from '../types';

const router = Router();

// Get all tasks
router.get('/', async (req: Request, res: Response) => {
  try {
    const tasks = await query<Task>(`
      SELECT * FROM clubhouse_tasks
      ORDER BY created_at DESC
    `);
    res.json(tasks);
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user's tasks
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sluggerUserId = req.user?.cognitoSub;
    if (!sluggerUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Find user by slugger_user_id
    const user = await queryOne<{ id: number }>(`
      SELECT id FROM clubhouse_users WHERE slugger_user_id = $1
    `, [sluggerUserId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tasks = await query<Task>(`
      SELECT * FROM clubhouse_tasks
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [user.id]);

    res.json(tasks);
  } catch (error: any) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tasks by user ID
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const user = await queryOne(`SELECT id FROM clubhouse_users WHERE id = $1`, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tasks = await query<Task>(`
      SELECT * FROM clubhouse_tasks
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json(tasks);
  } catch (error: any) {
    console.error('Error fetching tasks by user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tasks by completion status for a user
router.get('/user/:userId/status/:complete', async (req: Request, res: Response) => {
  try {
    const { userId, complete } = req.params;
    const isComplete = complete === 'true' || complete === '1';

    const user = await queryOne(`SELECT id FROM clubhouse_users WHERE id = $1`, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tasks = await query<Task>(`
      SELECT * FROM clubhouse_tasks
      WHERE user_id = $1 AND task_complete = $2
      ORDER BY created_at DESC
    `, [userId, isComplete]);

    res.json(tasks);
  } catch (error: any) {
    console.error('Error fetching tasks by status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single task by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await queryOne<Task>(`
      SELECT * FROM clubhouse_tasks WHERE id = $1
    `, [id]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error: any) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a task for current user
router.post('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sluggerUserId = req.user?.cognitoSub;
    if (!sluggerUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await queryOne<{ id: number }>(`
      SELECT id FROM clubhouse_users WHERE slugger_user_id = $1
    `, [sluggerUserId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const {
      task_name, task_description, task_complete, task_category,
      task_type, task_date, task_time, is_repeating, repeating_day
    } = req.body;

    const task = await queryOne<Task>(`
      INSERT INTO clubhouse_tasks (
        user_id, task_name, task_description, task_complete, task_category,
        task_type, task_date, task_time, is_repeating, repeating_day
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [user.id, task_name, task_description, task_complete || false, task_category,
        task_type, task_date, task_time, is_repeating || false, repeating_day]);

    res.status(201).json(task);
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a task for a specific user
router.post('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await queryOne(`SELECT id FROM clubhouse_users WHERE id = $1`, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const {
      task_name, task_description, task_complete, task_category,
      task_type, task_date, task_time, is_repeating, repeating_day
    } = req.body;

    const task = await queryOne<Task>(`
      INSERT INTO clubhouse_tasks (
        user_id, task_name, task_description, task_complete, task_category,
        task_type, task_date, task_time, is_repeating, repeating_day
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [userId, task_name, task_description, task_complete || false, task_category,
        task_type, task_date, task_time, is_repeating || false, repeating_day]);

    res.status(201).json(task);
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a task
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sluggerUserId = req.user?.cognitoSub;

    // Verify ownership if authenticated
    if (sluggerUserId) {
      const user = await queryOne<{ id: number }>(`
        SELECT id FROM clubhouse_users WHERE slugger_user_id = $1
      `, [sluggerUserId]);

      if (user) {
        const task = await queryOne<{ user_id: number }>(`
          SELECT user_id FROM clubhouse_tasks WHERE id = $1
        `, [id]);

        if (task && task.user_id !== user.id) {
          return res.status(403).json({ error: 'Forbidden: Cannot update other user\'s tasks' });
        }
      }
    }

    const {
      task_name, task_description, task_complete, task_category,
      task_type, task_date, task_time, is_repeating, repeating_day
    } = req.body;

    const task = await queryOne<Task>(`
      UPDATE clubhouse_tasks
      SET task_name = COALESCE($1, task_name),
          task_description = COALESCE($2, task_description),
          task_complete = COALESCE($3, task_complete),
          task_category = COALESCE($4, task_category),
          task_type = COALESCE($5, task_type),
          task_date = COALESCE($6, task_date),
          task_time = COALESCE($7, task_time),
          is_repeating = COALESCE($8, is_repeating),
          repeating_day = COALESCE($9, repeating_day)
      WHERE id = $10
      RETURNING *
    `, [task_name, task_description, task_complete, task_category,
        task_type, task_date, task_time, is_repeating, repeating_day, id]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error: any) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle task completion
router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const task = await queryOne<Task>(`
      UPDATE clubhouse_tasks
      SET task_complete = NOT task_complete
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error: any) {
    console.error('Error toggling task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a task
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sluggerUserId = req.user?.cognitoSub;

    // Verify ownership if authenticated
    if (sluggerUserId) {
      const user = await queryOne<{ id: number }>(`
        SELECT id FROM clubhouse_users WHERE slugger_user_id = $1
      `, [sluggerUserId]);

      if (user) {
        const task = await queryOne<{ user_id: number }>(`
          SELECT user_id FROM clubhouse_tasks WHERE id = $1
        `, [id]);

        if (task && task.user_id !== user.id) {
          return res.status(403).json({ error: 'Forbidden: Cannot delete other user\'s tasks' });
        }
      }
    }

    const rowCount = await execute(`DELETE FROM clubhouse_tasks WHERE id = $1`, [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
