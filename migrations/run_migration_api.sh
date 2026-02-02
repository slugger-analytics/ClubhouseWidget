#!/bin/bash

# ClubhouseWidget Migration Runner (API Method)
# Uses Supabase REST API - NO DATABASE PASSWORD NEEDED

set -e

echo "=========================================="
echo "ClubhouseWidget Migration: Supabase → Aurora"
echo "Using Supabase REST API (No DB password needed)"
echo "=========================================="
echo ""

# Check Python dependencies
echo "Checking Python dependencies..."
if ! python3 -c "import psycopg2" 2>/dev/null || ! python3 -c "import requests" 2>/dev/null; then
    echo "Installing dependencies..."
    pip3 install -r requirements_api.txt
fi

echo "✓ Dependencies ready"
echo ""

# Confirm migration
echo "⚠️  This will migrate ClubhouseWidget data from Supabase to Aurora"
echo ""
echo "What this script does:"
echo "  ✓ Exports data from Supabase via REST API (no DB password needed)"
echo "  ✓ Reads SLUGGER users for email mapping (read-only)"
echo "  ✓ Inserts into clubhouse_* tables in Aurora"
echo "  ✗ Does NOT modify any existing SLUGGER data"
echo ""
echo "Using credentials from frontend/.env:"
echo "  - Supabase URL: https://esmuegorbzltpkpmnxzu.supabase.co"
echo "  - API Key: (anon key from .env)"
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
python3 migrate_via_api.py

echo ""
echo "=========================================="
echo "Migration complete!"
echo "=========================================="
