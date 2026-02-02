# ClubhouseWidget API Mapping

## Supabase → Lambda API Endpoint Mapping

This document maps the current Supabase client calls to the new Lambda REST API endpoints.

---

## Users API

### Get Current User (by Cognito sub)
**Before (Supabase):**
```typescript
const { data } = await supabase
  .from('user')
  .select('*')
  .eq('slugger_user_id', cognitoSub)
  .single();
```

**After (Lambda):**
```typescript
const response = await fetch('/widgets/clubhouse/api/users/me', {
  credentials: 'include'
});
const data = await response.json();
```

### Get User with Data
**Before (Supabase):**
```typescript
// Multiple queries
const { data: user } = await supabase.from('user').select('*').eq('id', userId).single();
const { data: tasks } = await supabase.from('task').select('*').eq('user_id', userId);
const { data: inventory } = await supabase.from('inventory').select('*').eq('team_id', user.user_team);
```

**After (Lambda):**
```typescript
const response = await fetch(`/widgets/clubhouse/api/users/${userId}`, {
  credentials: 'include'
});
const { user, tasks, inventory } = await response.json();
```

---

## Tasks API

### Get User Tasks
**Before:**
```typescript
const { data } = await supabase
  .from('task')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

**After:**
```typescript
const response = await fetch(`/widgets/clubhouse/api/tasks?userId=${userId}`, {
  credentials: 'include'
});
```

### Create Task
**Before:**
```typescript
const { data } = await supabase
  .from('task')
  .insert([{ ...taskData, user_id: userId }])
  .select()
  .single();
```

**After:**
```typescript
const response = await fetch('/widgets/clubhouse/api/tasks', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...taskData, userId })
});
```

### Update Task
**Before:**
```typescript
const { data } = await supabase
  .from('task')
  .update(taskData)
  .eq('id', taskId)
  .select()
  .single();
```

**After:**
```typescript
const response = await fetch(`/widgets/clubhouse/api/tasks/${taskId}`, {
  method: 'PUT',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(taskData)
});
```

### Toggle Task Completion
**Before:**
```typescript
const { data: task } = await supabase.from('task').select('task_complete').eq('id', id).single();
const { data } = await supabase.from('task').update({ task_complete: !task.task_complete }).eq('id', id).select().single();
```

**After:**
```typescript
const response = await fetch(`/widgets/clubhouse/api/tasks/${taskId}/toggle`, {
  method: 'PATCH',
  credentials: 'include'
});
```

### Delete Task
**Before:**
```typescript
await supabase.from('task').delete().eq('id', taskId);
```

**After:**
```typescript
await fetch(`/widgets/clubhouse/api/tasks/${taskId}`, {
  method: 'DELETE',
  credentials: 'include'
});
```

---

## Inventory API

### Get Team Inventory
**Before:**
```typescript
const { data } = await supabase
  .from('inventory')
  .select('*')
  .eq('team_id', teamId)
  .order('created_at', { ascending: false });
```

**After:**
```typescript
const response = await fetch(`/widgets/clubhouse/api/inventory?teamId=${teamId}`, {
  credentials: 'include'
});
```

### Create Inventory Item
**Before:**
```typescript
const { data } = await supabase
  .from('inventory')
  .insert([{ ...itemData, team_id: teamId }])
  .select()
  .single();
```

**After:**
```typescript
const response = await fetch('/widgets/clubhouse/api/inventory', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...itemData, teamId })
});
```

### Update Inventory Item
**Before:**
```typescript
const { data } = await supabase
  .from('inventory')
  .update(itemData)
  .eq('id', itemId)
  .select()
  .single();
```

**After:**
```typescript
const response = await fetch(`/widgets/clubhouse/api/inventory/${itemId}`, {
  method: 'PUT',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(itemData)
});
```

### Delete Inventory Item
**Before:**
```typescript
await supabase.from('inventory').delete().eq('id', itemId);
```

**After:**
```typescript
await fetch(`/widgets/clubhouse/api/inventory/${itemId}`, {
  method: 'DELETE',
  credentials: 'include'
});
```

---

## Teams API

### Get All Teams
**Before:**
```typescript
const { data } = await supabase
  .from('teams')
  .select('*')
  .order('team_name', { ascending: true });
```

**After:**
```typescript
const response = await fetch('/widgets/clubhouse/api/teams', {
  credentials: 'include'
});
```

---

## Games API

### Get All Games
**Before:**
```typescript
const { data } = await supabase
  .from('games')
  .select('*')
  .order('date', { ascending: true })
  .order('time', { ascending: true });
```

**After:**
```typescript
const response = await fetch('/widgets/clubhouse/api/games', {
  credentials: 'include'
});
```

### Get Games by Team
**Before:**
```typescript
const { data } = await supabase
  .from('games')
  .select('*')
  .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
  .order('date', { ascending: true });
```

**After:**
```typescript
const response = await fetch(`/widgets/clubhouse/api/games?teamId=${teamId}`, {
  credentials: 'include'
});
```

### Create Game
**Before:**
```typescript
const { data } = await supabase
  .from('games')
  .insert([gameData])
  .select()
  .single();
```

**After:**
```typescript
const response = await fetch('/widgets/clubhouse/api/games', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(gameData)
});
```

---

## Meals API

### Get Meal by Game ID
**Before:**
```typescript
const { data } = await supabase
  .from('meals')
  .select('*')
  .eq('game_id', gameId)
  .maybeSingle();
```

**After:**
```typescript
const response = await fetch(`/widgets/clubhouse/api/meals/${gameId}`, {
  credentials: 'include'
});
```

### Upsert Meal
**Before:**
```typescript
// Check if exists, then insert or update
const existing = await mealsApi.getMealByGameId(gameId);
if (existing) {
  await supabase.from('meals').update(mealData).eq('id', existing.id);
} else {
  await supabase.from('meals').insert([{ game_id: gameId, ...mealData }]);
}
```

**After:**
```typescript
const response = await fetch(`/widgets/clubhouse/api/meals/${gameId}`, {
  method: 'PUT',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(mealData)
});
```

---

## Summary Table

| Domain | Supabase Method | Lambda Endpoint | HTTP Method |
|--------|----------------|-----------------|-------------|
| Users | `.from('user').eq('slugger_user_id')` | `/api/users/me` | GET |
| Users | `.from('user').eq('id')` | `/api/users/:id` | GET |
| Tasks | `.from('task').select()` | `/api/tasks` | GET |
| Tasks | `.from('task').insert()` | `/api/tasks` | POST |
| Tasks | `.from('task').update()` | `/api/tasks/:id` | PUT |
| Tasks | `.from('task').delete()` | `/api/tasks/:id` | DELETE |
| Tasks | toggle completion | `/api/tasks/:id/toggle` | PATCH |
| Inventory | `.from('inventory').select()` | `/api/inventory` | GET |
| Inventory | `.from('inventory').insert()` | `/api/inventory` | POST |
| Inventory | `.from('inventory').update()` | `/api/inventory/:id` | PUT |
| Inventory | `.from('inventory').delete()` | `/api/inventory/:id` | DELETE |
| Teams | `.from('teams').select()` | `/api/teams` | GET |
| Games | `.from('games').select()` | `/api/games` | GET |
| Games | `.from('games').insert()` | `/api/games` | POST |
| Games | `.from('games').update()` | `/api/games/:id` | PUT |
| Games | `.from('games').delete()` | `/api/games/:id` | DELETE |
| Meals | `.from('meals').eq('game_id')` | `/api/meals/:gameId` | GET |
| Meals | upsert | `/api/meals/:gameId` | PUT |
