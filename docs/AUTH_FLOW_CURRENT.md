# ClubhouseWidget Current Authentication Flow

## Overview

The current authentication flow uses **JWT tokens passed via PostMessage** from the SLUGGER shell to the widget running in an iframe.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SLUGGER Shell (Parent)                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  1. User logs in via Cognito                                            ││
│  │  2. Shell receives accessToken + idToken                                ││
│  │  3. Shell loads widget in iframe                                        ││
│  │  4. Shell listens for SLUGGER_WIDGET_READY message                      ││
│  │  5. Shell sends SLUGGER_AUTH message with tokens                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              │                                               │
│                              │ postMessage                                   │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    ClubhouseWidget (iframe)                             ││
│  │                                                                          ││
│  │  1. Widget loads, SDK sends SLUGGER_WIDGET_READY                        ││
│  │  2. SDK receives SLUGGER_AUTH with JWT tokens                           ││
│  │  3. SDK decodes idToken to extract user.id (Cognito sub)                ││
│  │  4. Widget calls Supabase: SELECT * FROM user WHERE slugger_user_id = ? ││
│  │  5. All subsequent API calls use Supabase anon key                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `services/slugger-widget-sdk.ts` | PostMessage handling, JWT decode, token management |
| `hooks/useSluggerAuth.ts` | React hook wrapping SDK initialization |
| `contexts/AuthContext.tsx` | Dual-mode auth (iframe vs standalone) |
| `services/api.ts` | Supabase client calls |
| `utils/supabase/client.tsx` | Supabase client initialization |
| `utils/supabase/info.tsx` | Supabase project ID and anon key |

## Authentication Modes

### 1. Iframe Mode (SLUGGER Shell)
- Detected via `window.self !== window.top`
- Uses PostMessage JWT flow
- User ID extracted from JWT `sub` claim
- Looks up user in Supabase by `slugger_user_id`

### 2. Standalone Mode (Direct Access)
- For development/testing without SLUGGER shell
- Uses localStorage to persist user selection
- Manual login by entering `slugger_user_id`

## Security Concerns

1. **Client-side JWT decode**: Token validation happens in browser, not server
2. **Supabase anon key exposed**: Key is hardcoded in `info.tsx`
3. **No RLS policies**: Supabase tables have no row-level security
4. **Cross-origin risks**: PostMessage accepts multiple origins

## Token Structure

```javascript
// SLUGGER_AUTH message payload
{
  type: 'SLUGGER_AUTH',
  payload: {
    accessToken: 'eyJ...',  // Cognito access token
    idToken: 'eyJ...',      // Cognito ID token (contains user info)
    expiresAt: 1234567890   // Token expiration timestamp
  }
}

// Decoded idToken payload
{
  sub: 'abc123-def456',     // Cognito user ID (used as slugger_user_id)
  email: 'user@example.com',
  email_verified: true,
  given_name: 'John',
  family_name: 'Doe'
}
```

## Data Flow

```
1. Shell → postMessage(SLUGGER_AUTH) → Widget SDK
2. SDK → decode(idToken) → user.id (Cognito sub)
3. Widget → Supabase.from('user').eq('slugger_user_id', user.id)
4. Supabase → Returns user record with team_id
5. Widget → Supabase.from('task').eq('user_id', user.id)
6. Widget → Supabase.from('inventory').eq('team_id', team_id)
```

## Problems with Current Flow

1. **Complexity**: Multiple layers of token handling
2. **Security**: Client-side token validation
3. **Coupling**: Tight coupling to Supabase
4. **Maintenance**: SDK must be kept in sync with shell
5. **Testing**: Hard to test without SLUGGER shell running
