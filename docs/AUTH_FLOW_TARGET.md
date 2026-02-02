# ClubhouseWidget Target Authentication Flow

## Overview

The target authentication flow uses **same-origin cookie authentication**. Since the widget is hosted at `/widgets/clubhouse/*` on the same domain as SLUGGER, the browser automatically sends httpOnly session cookies with every request.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SLUGGER Platform                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                              ALB                                         ││
│  │  Same domain: slugger-alb-*.elb.amazonaws.com                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              │                                               │
│         ┌────────────────────┼────────────────────┐                         │
│         ▼                    ▼                    ▼                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐       │
│  │   /*        │     │   /api/*    │     │ /widgets/clubhouse/*    │       │
│  │  Frontend   │     │   Backend   │     │   Lambda (Widget)       │       │
│  │  (ECS)      │     │   (ECS)     │     │                         │       │
│  └─────────────┘     └─────────────┘     └─────────────────────────┘       │
│         │                    │                    │                         │
│         │                    │                    │                         │
│         └────────────────────┴────────────────────┘                         │
│                              │                                               │
│                    httpOnly session cookie                                  │
│                    (automatically sent by browser)                          │
│                              │                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    Aurora PostgreSQL                                     ││
│  │  SLUGGER tables ←──── clubhouse_* tables (FK via slugger_user_id)       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Simplified Flow

```
1. User logs into SLUGGER (Cognito auth, session cookie set)
2. User navigates to widget page
3. SLUGGER frontend loads widget iframe: /widgets/clubhouse/
4. Browser automatically includes session cookie (same origin!)
5. Widget calls /widgets/clubhouse/api/users/me
6. Lambda validates session cookie via Cognito
7. Lambda queries Aurora: SELECT * FROM clubhouse_users WHERE slugger_user_id = ?
8. Widget receives user data, no client-side token handling needed
```

## Key Benefits

| Aspect | Before (PostMessage JWT) | After (Cookie Auth) |
|--------|-------------------------|---------------------|
| Token handling | Client-side decode | Server-side validation |
| Security | Exposed in browser | httpOnly, secure |
| Complexity | SDK + hooks + context | Simple fetch calls |
| CORS | Cross-origin setup | Same-origin (none) |
| Testing | Requires shell | Can test standalone |

## Files to Create/Modify

### New Files (Lambda Backend)

| File | Purpose |
|------|---------|
| `lambda/src/index.ts` | Express app entry point |
| `lambda/src/middleware/auth.ts` | Cookie validation middleware |
| `lambda/src/routes/users.ts` | User API endpoints |
| `lambda/src/routes/tasks.ts` | Task CRUD endpoints |
| `lambda/src/routes/inventory.ts` | Inventory CRUD endpoints |
| `lambda/src/routes/games.ts` | Games endpoints |
| `lambda/src/routes/meals.ts` | Meals endpoints |
| `lambda/src/routes/teams.ts` | Teams endpoints |
| `lambda/src/db/pool.ts` | PostgreSQL connection pool |

### Files to Modify (Frontend)

| File | Action |
|------|--------|
| `services/api.ts` | Replace Supabase calls with fetch() |
| `contexts/AuthContext.tsx` | Simplify to cookie-based auth |

### Files to Delete

| File | Reason |
|------|--------|
| `services/slugger-widget-sdk.ts` | No longer needed |
| `hooks/useSluggerAuth.ts` | No longer needed |
| `utils/supabase/client.tsx` | No longer needed |
| `utils/supabase/info.tsx` | No longer needed |

## API Endpoints

All endpoints are relative to `/widgets/clubhouse/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user from session |
| GET | `/users/:id` | Get user with tasks + inventory |
| GET | `/tasks` | Get user's tasks |
| POST | `/tasks` | Create task |
| PUT | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |
| GET | `/inventory` | Get team inventory |
| POST | `/inventory` | Create inventory item |
| PUT | `/inventory/:id` | Update inventory item |
| DELETE | `/inventory/:id` | Delete inventory item |
| GET | `/teams` | Get all teams |
| GET | `/games` | Get games |
| POST | `/games` | Create game |
| PUT | `/games/:id` | Update game |
| DELETE | `/games/:id` | Delete game |
| GET | `/meals/:gameId` | Get meal for game |
| PUT | `/meals/:gameId` | Upsert meal |

## Auth Middleware

```typescript
// lambda/src/middleware/auth.ts
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export async function authMiddleware(req, res, next) {
  // Get token from cookie or Authorization header
  const token = req.cookies?.accessToken || 
                req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const payload = await verifier.verify(token);
    req.user = { 
      cognitoSub: payload.sub, 
      username: payload.username 
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

## Frontend API Client

```typescript
// services/api.ts (simplified)
const API_BASE = '/widgets/clubhouse/api';

export const userApi = {
  getCurrentUser: async () => {
    const res = await fetch(`${API_BASE}/users/me`, {
      credentials: 'include' // Include cookies
    });
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  },
  // ... other methods
};
```

## AuthContext (Simplified)

```typescript
// contexts/AuthContext.tsx (simplified)
export const AuthProvider: React.FC<Props> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simply fetch current user - cookie auth handles the rest
    userApi.getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

## Migration Checklist

- [ ] Create Lambda backend with Express
- [ ] Implement auth middleware (Cognito cookie validation)
- [ ] Create all API routes
- [ ] Update frontend api.ts to use fetch
- [ ] Simplify AuthContext
- [ ] Remove slugger-widget-sdk.ts
- [ ] Remove useSluggerAuth.ts
- [ ] Remove utils/supabase/ directory
- [ ] Update package.json (remove @supabase/supabase-js)
- [ ] Test in SLUGGER iframe
- [ ] Verify cookie auth works
