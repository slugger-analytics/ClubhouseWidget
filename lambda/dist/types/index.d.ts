export interface User {
    id: number;
    slugger_user_id: string;
    user_name: string | null;
    user_role: string | null;
    team_id: number | null;
    created_at: string;
    team_name?: string | null;
}
export interface Task {
    id: number;
    user_id: number;
    task_name: string | null;
    task_description: string | null;
    task_complete: boolean;
    task_category: string | null;
    task_type: number | null;
    task_date: string | null;
    task_time: string | null;
    is_repeating: boolean;
    repeating_day: number | null;
    created_at: string;
}
export interface Team {
    id: number;
    team_name: string;
    slugger_team_id: number | null;
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
export interface Inventory {
    id: number;
    team_id: number | null;
    meal_id: number | null;
    inventory_type: string | null;
    inventory_item: string | null;
    current_stock: number | null;
    required_stock: number | null;
    unit: string | null;
    purchase_link: string | null;
    note: string | null;
    price_per_unit: number | null;
    created_at: string;
}
//# sourceMappingURL=index.d.ts.map