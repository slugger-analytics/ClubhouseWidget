#!/bin/bash

# ClubhouseWidget Migration Runner
# This script helps run the Supabase to Aurora migration

set -e

echo "=========================================="
echo "ClubhouseWidget Migration: Supabase → Aurora"
echo "=========================================="
echo ""

# Check if SUPABASE_DB_URL is set
if [ -z "$SUPABASE_DB_URL" ]; then
    echo "❌ ERROR: SUPABASE_DB_URL environment variable not set"
    echo ""
    echo "Please set your Supabase database connection string:"
    echo ""
    echo "  export SUPABASE_DB_URL='postgresql://postgres:[PASSWORD]@db.esmuegorbzltpkpmnxzu.supabase.co:5432/postgres'"
    echo ""
    echo "Get this from: Supabase Dashboard → Settings → Database → Connection String"
    exit 1
fi

# Check Python dependencies
echo "Checking Python dependencies..."
if ! python3 -c "import psycopg2" 2>/dev/null; then
    echo "Installing dependencies..."
    pip3 install -r requirements.txt
fi

echo "✓ Dependencies ready"
echo ""

# Confirm migration
echo "⚠️  This will migrate ClubhouseWidget data from Supabase to Aurora"
echo ""
echo "What this script does:"
echo "  ✓ Exports data from Supabase (read-only)"
echo "  ✓ Reads SLUGGER users for email mapping (read-only)"
echo "  ✓ Inserts into clubhouse_* tables in Aurora"
echo "  ✗ Does NOT modify any existing SLUGGER data"
echo ""
read -p "Continue with migration? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled"
    exit 0
fi

echo ""
echo "Starting migration..."
echo ""

# Run migration
python3 migrate_supabase_to_aurora.py

echo ""
echo "=========================================="
echo "Migration complete!"
echo "=========================================="
