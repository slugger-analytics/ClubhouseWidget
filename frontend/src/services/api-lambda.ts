// Lambda API Service for ClubhouseWidget
// All API calls go to the Lambda backend on the same domain.
// Authentication is handled via the shared SLUGGER session cookie (accessToken).

const API_BASE = '/widgets/clubhouse/api';

// Types
export type TaskCategory = 
  | 'Medical & Safety'
  | 'Equipment & Field Support'
  | 'Laundry & Cleaning'
  | 'Hygiene & Personal Care'
  | 'Meals & Nutrition'
  | 'Misc';

export interface User {
  id: number;
  created_at: string;
  user_role: string | null;
  user_team: number | null;
  team_id?: number | null;
  team_name?: string | null;
  slugger_user_id: string | null;
  user_name: string | null;
}

export interface Inventory {
  id: number;
  team_id: number | null;
  meal_id: number | null;
  inventory_type: TaskCategory | null;
  inventory_item: string | null;
  current_stock: number | null;
  required_stock: number | null;
  unit: string | null;
  purchase_link: string | null;
  note: string | null;
  price_per_unit: number | null;
  created_at: string;
}

export interface Task {
  id: number;
  user_id: number | null;
  task_name: string | null;
  task_complete: boolean | null;
  task_category: TaskCategory | null;
  task_description: string | null;
  task_type: number | null;
  task_date: string | null;
  task_time: string | null;
  is_repeating: boolean;
  repeating_day: number | null;
  created_at: string;
}

export interface UserWithData extends User {
  inventory: Inventory[];
  tasks: Task[];
}

export interface Team {
  id: number;
  team_name: string;
  slugger_team_id?: number | null;
  created_at: string;
}

export interface Game {
  id: number;
  home_team_id: number;
  away_team_id: number;
  date: string | null;
  time: string | null;
  created_at: string;
  home_team_name?: string;
  away_team_name?: string;
}

export interface Meal {
  id: number;
  game_id: number;
  pre_game_snack: string | null;
  post_game_meal: string | null;
  created_at: string;
}

// Helper for API calls
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // Send cookies with every request
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// User API calls
export const userApi = {
  // Get current user (from JWT cookie)
  getCurrentUser: async (): Promise<User> => {
    return apiFetch<User>('/users/me');
  },

  // Get current user with all data
  getCurrentUserWithData: async (): Promise<UserWithData> => {
    return apiFetch<UserWithData>('/users/me/complete');
  },

  // Get user by slugger_user_id
  getUserBySluggerId: async (sluggerUserId: string): Promise<User> => {
    return apiFetch<User>(`/users/slugger/${encodeURIComponent(sluggerUserId)}`);
  },

  // Get user by ID with all associated data
  getUserWithData: async (userId: number): Promise<UserWithData> => {
    return apiFetch<UserWithData>(`/users/${userId}/complete`);
  },

  // Get all users
  getAllUsers: async (): Promise<User[]> => {
    return apiFetch<User[]>('/users');
  },

  // Get users by team
  getUsersByTeam: async (teamId: number): Promise<User[]> => {
    return apiFetch<User[]>(`/users/team/${teamId}`);
  },

  // Create user
  createUser: async (data: { slugger_user_id: string; user_name?: string; user_role?: string; team_id?: number }): Promise<User> => {
    return apiFetch<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update user
  updateUser: async (id: number, data: Partial<Omit<User, 'id' | 'created_at'>>): Promise<User> => {
    return apiFetch<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete user
  deleteUser: async (id: number): Promise<void> => {
    return apiFetch<void>(`/users/${id}`, { method: 'DELETE' });
  },
};

// Inventory API calls
export const inventoryApi = {
  // Get current user's team inventory
  getCurrentUserTeamInventory: async (): Promise<Inventory[]> => {
    return apiFetch<Inventory[]>('/inventory/me/team');
  },

  // Get inventory for a specific team
  getTeamInventory: async (teamId: number): Promise<Inventory[]> => {
    return apiFetch<Inventory[]>(`/inventory/team/${teamId}`);
  },

  // Get all inventory items
  getAllInventory: async (): Promise<Inventory[]> => {
    return apiFetch<Inventory[]>('/inventory');
  },

  // Get single inventory item
  getInventory: async (id: number): Promise<Inventory> => {
    return apiFetch<Inventory>(`/inventory/${id}`);
  },

  // Create inventory item for current user's team
  createInventoryForCurrentUser: async (data: Omit<Inventory, 'id' | 'created_at' | 'team_id'>): Promise<Inventory> => {
    return apiFetch<Inventory>('/inventory/me/team', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Create inventory item for a team
  createInventory: async (teamId: number, data: Omit<Inventory, 'id' | 'created_at' | 'team_id'>): Promise<Inventory> => {
    return apiFetch<Inventory>(`/inventory/team/${teamId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update inventory item
  updateInventory: async (id: number, data: Partial<Omit<Inventory, 'id' | 'created_at' | 'team_id'>>): Promise<Inventory> => {
    return apiFetch<Inventory>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete inventory item
  deleteInventory: async (id: number): Promise<void> => {
    return apiFetch<void>(`/inventory/${id}`, { method: 'DELETE' });
  },
};

// Task API calls
export const taskApi = {
  // Get current user's tasks
  getCurrentUserTasks: async (): Promise<Task[]> => {
    return apiFetch<Task[]>('/tasks/me');
  },

  // Get tasks for a specific user
  getUserTasks: async (userId: number): Promise<Task[]> => {
    return apiFetch<Task[]>(`/tasks/user/${userId}`);
  },

  // Get all tasks
  getAllTasks: async (): Promise<Task[]> => {
    return apiFetch<Task[]>('/tasks');
  },

  // Get single task
  getTask: async (id: number): Promise<Task> => {
    return apiFetch<Task>(`/tasks/${id}`);
  },

  // Create task for current user
  createTaskForCurrentUser: async (data: Omit<Task, 'id' | 'created_at' | 'user_id'>): Promise<Task> => {
    return apiFetch<Task>('/tasks/me', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Create task for a user
  createTask: async (userId: number, data: Omit<Task, 'id' | 'created_at' | 'user_id'>): Promise<Task> => {
    return apiFetch<Task>(`/tasks/user/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update task
  updateTask: async (id: number, data: Partial<Omit<Task, 'id' | 'created_at' | 'user_id'>>): Promise<Task> => {
    return apiFetch<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Toggle task completion
  toggleTask: async (id: number): Promise<Task> => {
    return apiFetch<Task>(`/tasks/${id}/toggle`, { method: 'PATCH' });
  },

  // Delete task
  deleteTask: async (id: number): Promise<void> => {
    return apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' });
  },
};

// Games API calls
export const gamesApi = {
  // Get all games
  getAllGames: async (): Promise<Game[]> => {
    return apiFetch<Game[]>('/games');
  },

  // Get game by ID
  getGame: async (id: number): Promise<Game> => {
    return apiFetch<Game>(`/games/${id}`);
  },

  // Get games by date
  getGamesByDate: async (date: string): Promise<Game[]> => {
    return apiFetch<Game[]>(`/games/date/${date}`);
  },

  // Get games by team ID
  getGamesByTeam: async (teamId: number): Promise<Game[]> => {
    return apiFetch<Game[]>(`/games/team/${teamId}`);
  },

  // Create game
  createGame: async (data: Omit<Game, 'id' | 'created_at' | 'home_team_name' | 'away_team_name'>): Promise<Game> => {
    return apiFetch<Game>('/games', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update game
  updateGame: async (id: number, data: Partial<Omit<Game, 'id' | 'created_at' | 'home_team_name' | 'away_team_name'>>): Promise<Game> => {
    return apiFetch<Game>(`/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete game
  deleteGame: async (id: number): Promise<void> => {
    return apiFetch<void>(`/games/${id}`, { method: 'DELETE' });
  },
};

// Teams API calls
export const teamsApi = {
  // Get all teams
  getAllTeams: async (): Promise<Team[]> => {
    return apiFetch<Team[]>('/teams');
  },

  // Get team by ID
  getTeam: async (id: number): Promise<Team> => {
    return apiFetch<Team>(`/teams/${id}`);
  },

  // Create team
  createTeam: async (data: Omit<Team, 'id' | 'created_at'>): Promise<Team> => {
    return apiFetch<Team>('/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update team
  updateTeam: async (id: number, data: Partial<Omit<Team, 'id' | 'created_at'>>): Promise<Team> => {
    return apiFetch<Team>(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete team
  deleteTeam: async (id: number): Promise<void> => {
    return apiFetch<void>(`/teams/${id}`, { method: 'DELETE' });
  },
};

// Meals API calls
export const mealsApi = {
  // Get all meals
  getAllMeals: async (): Promise<Meal[]> => {
    return apiFetch<Meal[]>('/meals');
  },

  // Get meal by game ID
  getMealByGameId: async (gameId: number): Promise<Meal | null> => {
    try {
      return await apiFetch<Meal>(`/meals/game/${gameId}`);
    } catch {
      return null;
    }
  },

  // Get meals for multiple games
  getMealsByGameIds: async (gameIds: number[]): Promise<Meal[]> => {
    if (gameIds.length === 0) return [];
    // Fetch all meals and filter client-side (simpler than batch endpoint)
    const allMeals = await apiFetch<Meal[]>('/meals');
    return allMeals.filter(meal => gameIds.includes(meal.game_id));
  },

  // Get meal by ID
  getMeal: async (id: number): Promise<Meal> => {
    return apiFetch<Meal>(`/meals/${id}`);
  },

  // Create or update meal for a game (upsert)
  upsertMeal: async (gameId: number, data: { pre_game_snack?: string | null; post_game_meal?: string | null }): Promise<Meal> => {
    return apiFetch<Meal>(`/meals/game/${gameId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Create meal
  createMeal: async (data: Omit<Meal, 'id' | 'created_at'>): Promise<Meal> => {
    return apiFetch<Meal>('/meals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update meal
  updateMeal: async (id: number, data: Partial<Omit<Meal, 'id' | 'created_at' | 'game_id'>>): Promise<Meal> => {
    return apiFetch<Meal>(`/meals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete meal
  deleteMeal: async (id: number): Promise<void> => {
    return apiFetch<void>(`/meals/${id}`, { method: 'DELETE' });
  },
};

// Health check
export const healthApi = {
  check: async (): Promise<{ status: string; message: string; timestamp: string }> => {
    const response = await fetch('/widgets/clubhouse/health', { credentials: 'include' });
    return response.json();
  },
};
