# How to Get Supabase Connection String

## Method 1: Via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Login to your account

2. **Select Your Project**
   - Find and click on your ClubhouseWidget project
   - Project Reference: `esmuegorbzltpkpmnxzu`

3. **Navigate to Database Settings**
   - Click on **Settings** (gear icon in left sidebar)
   - Click on **Database**

4. **Copy Connection String**
   - Scroll to **Connection string** section
   - Select **URI** tab
   - You'll see something like:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.esmuegorbzltpkpmnxzu.supabase.co:5432/postgres
     ```
   - Click **Copy** or manually copy the string
   - **Replace `[YOUR-PASSWORD]`** with your actual database password

5. **Set Environment Variable**
   ```bash
   export SUPABASE_DB_URL='postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.esmuegorbzltpkpmnxzu.supabase.co:5432/postgres'
   ```

## Method 2: Via Supabase CLI

If you have the Supabase CLI linked to your project:

```bash
cd /Users/leduckien/personalproject/SLUGGER/ClubhouseWidget
supabase db dump --db-url postgres://postgres:[PASSWORD]@db.esmuegorbzltpkpmnxzu.supabase.co:5432/postgres
```

## Method 3: Check Existing Config Files

Your connection string might already be in:

```bash
# Check backend .env file (if it exists)
cat ClubhouseWidget/backend/.env

# Or check any local Supabase config
cat ClubhouseWidget/.env
```

## Connection String Format

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

For your project:
- **User**: `postgres`
- **Password**: Your Supabase database password
- **Host**: `db.esmuegorbzltpkpmnxzu.supabase.co`
- **Port**: `5432`
- **Database**: `postgres`

## Finding Your Password

If you don't remember your database password:

1. Go to Supabase Dashboard → Settings → Database
2. Click **Reset database password**
3. Set a new password
4. Use that password in your connection string

## Test Connection

Once you have the connection string, test it:

```bash
export SUPABASE_DB_URL='postgresql://postgres:YOUR_PASSWORD@db.esmuegorbzltpkpmnxzu.supabase.co:5432/postgres'

# Test with psql
psql "$SUPABASE_DB_URL" -c "SELECT version();"
```

If successful, you'll see PostgreSQL version info.

## Security Note

⚠️ **Never commit your connection string to Git!**
- Keep it in environment variables
- Add `.env` files to `.gitignore`
- Use the connection string only locally for migration
