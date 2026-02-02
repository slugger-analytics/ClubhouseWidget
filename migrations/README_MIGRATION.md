# ClubhouseWidget Migration: Supabase → Aurora

## Overview

This migration script moves ClubhouseWidget data from Supabase to AWS Aurora PostgreSQL.

**IMPORTANT**: This script is **READ-ONLY** for SLUGGER data. It only:
- ✅ Reads SLUGGER `users` table to map emails to Cognito IDs
- ✅ Writes to `clubhouse_*` tables in Aurora
- ❌ Never modifies existing SLUGGER data

## Prerequisites

1. **Supabase Database URL**
   - Get from: Supabase Dashboard → Settings → Database → Connection String
   - Format: `postgresql://postgres:[PASSWORD]@db.esmuegorbzltpkpmnxzu.supabase.co:5432/postgres`

2. **Python Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Aurora Access**
   - Already configured in script (alpb-1.cluster...)

## Migration Steps

### 1. Set Supabase Connection

```bash
export SUPABASE_DB_URL='postgresql://postgres:[YOUR-PASSWORD]@db.esmuegorbzltpkpmnxzu.supabase.co:5432/postgres'
```

### 2. Run Migration

```bash
cd /Users/leduckien/personalproject/SLUGGER/ClubhouseWidget/migrations
python3 migrate_supabase_to_aurora.py
```

### 3. Verify Results

The script will output:
- Number of records exported from Supabase
- User mapping status (matched vs unmapped)
- Final row counts in Aurora tables

## What Gets Migrated

| Supabase Table | Aurora Table | Notes |
|----------------|--------------|-------|
| `teams` | `clubhouse_teams` | New IDs generated |
| `users` | `clubhouse_users` | Mapped to SLUGGER users by email |
| `tasks` | `clubhouse_tasks` | Linked to clubhouse_users |
| `games` | `clubhouse_games` | Linked to clubhouse_teams |
| `meals` | `clubhouse_meals` | Linked to clubhouse_games |
| `inventory` | `clubhouse_inventory` | Linked to teams/meals |

## User Mapping Logic

```
Supabase User (email) → SLUGGER User (email) → Cognito ID → clubhouse_users.slugger_user_id
```

**Example**:
- Supabase user: `john@example.com`
- SLUGGER user: `john@example.com` → Cognito ID: `abc-123-def`
- Result: `clubhouse_users.slugger_user_id = 'abc-123-def'`

## Safety Features

1. **No SLUGGER Data Modified**: Script only reads from SLUGGER `users` table
2. **Transaction Rollback**: If migration fails, all changes are rolled back
3. **Supabase Unchanged**: Original Supabase data remains intact
4. **Easy Rollback**: Can truncate `clubhouse_*` tables and retry

## Rollback (if needed)

```sql
-- Connect to Aurora
psql -h alpb-1.cluster-cx866cecsebt.us-east-2.rds.amazonaws.com -U postgres -d postgres

-- Truncate all clubhouse tables
TRUNCATE TABLE clubhouse_inventory CASCADE;
TRUNCATE TABLE clubhouse_meals CASCADE;
TRUNCATE TABLE clubhouse_tasks CASCADE;
TRUNCATE TABLE clubhouse_games CASCADE;
TRUNCATE TABLE clubhouse_users CASCADE;
TRUNCATE TABLE clubhouse_teams CASCADE;
```

## Troubleshooting

### "SUPABASE_DB_URL not set"
Set the environment variable with your Supabase connection string.

### "No SLUGGER user found for email"
Some Supabase users may not exist in SLUGGER. These users will be skipped with a warning.

### "Failed to connect to Aurora"
Check that you're connected to the network with access to the Aurora database.

## Post-Migration

1. Test API endpoints: `https://slugger-alb-1518464736.us-east-2.elb.amazonaws.com/widgets/clubhouse/`
2. Verify user authentication works
3. Check that all data is accessible via the widget
4. Keep Supabase as backup (read-only) until confirmed working
