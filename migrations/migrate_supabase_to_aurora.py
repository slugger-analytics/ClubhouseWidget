#!/usr/bin/env python3
"""
Supabase to Aurora Migration Script for ClubhouseWidget
Uses Supabase CLI to export data and migrates to AWS Aurora PostgreSQL

Prerequisites:
- Supabase CLI installed and logged in
- Python packages: psycopg2-binary, python-dotenv
- Access to both Supabase and Aurora databases
"""

import os
import sys
import json
import subprocess
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# Aurora Connection Details
AURORA_CONFIG = {
    'host': 'alpb-1.cluster-cx866cecsebt.us-east-2.rds.amazonaws.com',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'QETUO123$%^',
    'port': 5432
}

# Supabase Project Reference
SUPABASE_PROJECT_REF = 'esmuegorbzltpkpmnxzu'

class MigrationLogger:
    """Simple logger for migration progress"""
    
    @staticmethod
    def info(message: str):
        print(f"[INFO] {datetime.now().strftime('%H:%M:%S')} - {message}")
    
    @staticmethod
    def success(message: str):
        print(f"[SUCCESS] {datetime.now().strftime('%H:%M:%S')} - ✓ {message}")
    
    @staticmethod
    def error(message: str):
        print(f"[ERROR] {datetime.now().strftime('%H:%M:%S')} - ✗ {message}")
    
    @staticmethod
    def warning(message: str):
        print(f"[WARNING] {datetime.now().strftime('%H:%M:%S')} - ⚠ {message}")


class SupabaseExporter:
    """Handles data export from Supabase using CLI"""
    
    def __init__(self, project_ref: str):
        self.project_ref = project_ref
        self.export_dir = '/tmp/clubhouse_migration'
        os.makedirs(self.export_dir, exist_ok=True)
    
    def export_table_to_json(self, table_name: str) -> List[Dict]:
        """Export a Supabase table to JSON using CLI"""
        MigrationLogger.info(f"Exporting Supabase table: {table_name}")
        
        try:
            # Use supabase db dump to get SQL, then parse it
            # Alternative: Use direct SQL query via supabase db
            cmd = [
                'supabase', 'db', 'dump',
                '--db-url', f'postgresql://postgres.[{self.project_ref}]@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
                '--data-only',
                '--table', table_name
            ]
            
            # For now, use direct psql connection via Supabase
            # We'll use the REST API approach instead
            return self._export_via_rest_api(table_name)
            
        except Exception as e:
            MigrationLogger.error(f"Failed to export {table_name}: {e}")
            return []
    
    def _export_via_rest_api(self, table_name: str) -> List[Dict]:
        """Export table data using Supabase REST API via CLI"""
        try:
            # Use supabase CLI to execute SQL query
            sql_query = f"SELECT * FROM {table_name};"
            output_file = os.path.join(self.export_dir, f"{table_name}.json")
            
            # Execute SQL and capture output
            cmd = f"supabase db execute --project-ref {self.project_ref} --query \"{sql_query}\" --output json > {output_file}"
            
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode != 0:
                MigrationLogger.warning(f"CLI export failed for {table_name}, trying direct connection")
                return self._export_via_direct_connection(table_name)
            
            # Read the JSON file
            with open(output_file, 'r') as f:
                data = json.load(f)
            
            MigrationLogger.success(f"Exported {len(data)} rows from {table_name}")
            return data
            
        except Exception as e:
            MigrationLogger.error(f"REST API export failed for {table_name}: {e}")
            return self._export_via_direct_connection(table_name)
    
    def _export_via_direct_connection(self, table_name: str) -> List[Dict]:
        """Fallback: Export using direct PostgreSQL connection"""
        MigrationLogger.info(f"Using direct connection for {table_name}")
        
        # User will need to provide Supabase connection string
        supabase_url = os.getenv('SUPABASE_DB_URL')
        if not supabase_url:
            MigrationLogger.error("SUPABASE_DB_URL environment variable not set")
            MigrationLogger.info("Please set: export SUPABASE_DB_URL='postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres'")
            return []
        
        try:
            conn = psycopg2.connect(supabase_url)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(f"SELECT * FROM {table_name}")
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
            
            # Convert to list of dicts
            data = [dict(row) for row in rows]
            MigrationLogger.success(f"Exported {len(data)} rows from {table_name}")
            return data
            
        except Exception as e:
            MigrationLogger.error(f"Direct connection failed for {table_name}: {e}")
            return []


class AuroraMigrator:
    """Handles migration to Aurora PostgreSQL"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.conn = None
        self.cursor = None
        self.id_mappings = {
            'teams': {},
            'users': {},
            'games': {},
            'meals': {}
        }
    
    def connect(self):
        """Connect to Aurora database"""
        try:
            self.conn = psycopg2.connect(**self.config)
            self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            MigrationLogger.success("Connected to Aurora PostgreSQL")
        except Exception as e:
            MigrationLogger.error(f"Failed to connect to Aurora: {e}")
            sys.exit(1)
    
    def close(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        MigrationLogger.info("Closed Aurora connection")
    
    def get_slugger_user_mapping(self) -> Dict[str, str]:
        """
        Create mapping: email -> cognito_user_id
        Returns dict of {email: cognito_user_id}
        """
        MigrationLogger.info("Building SLUGGER user email mapping...")
        
        try:
            self.cursor.execute("""
                SELECT email, cognito_user_id 
                FROM users 
                WHERE email IS NOT NULL
            """)
            rows = self.cursor.fetchall()
            
            mapping = {row['email'].lower(): row['cognito_user_id'] for row in rows}
            MigrationLogger.success(f"Mapped {len(mapping)} SLUGGER users by email")
            return mapping
            
        except Exception as e:
            MigrationLogger.error(f"Failed to build user mapping: {e}")
            return {}
    
    def migrate_teams(self, teams_data: List[Dict]) -> Dict[int, int]:
        """
        Migrate teams table
        Returns mapping: {old_id: new_id}
        """
        MigrationLogger.info(f"Migrating {len(teams_data)} teams...")
        mapping = {}
        
        for team in teams_data:
            try:
                self.cursor.execute("""
                    INSERT INTO clubhouse_teams (team_name, created_at)
                    VALUES (%s, %s)
                    RETURNING id
                """, (
                    team.get('team_name'),
                    team.get('created_at', datetime.now())
                ))
                
                new_id = self.cursor.fetchone()['id']
                old_id = team.get('id')
                mapping[old_id] = new_id
                
            except Exception as e:
                MigrationLogger.error(f"Failed to migrate team {team.get('team_name')}: {e}")
        
        self.conn.commit()
        MigrationLogger.success(f"Migrated {len(mapping)} teams")
        return mapping
    
    def migrate_users(self, users_data: List[Dict], team_mapping: Dict, email_to_cognito: Dict) -> Dict[int, int]:
        """
        Migrate users table with SLUGGER user mapping
        Returns mapping: {old_id: new_id}
        """
        MigrationLogger.info(f"Migrating {len(users_data)} users...")
        mapping = {}
        unmapped_users = []
        
        for user in users_data:
            try:
                # Get user email from Supabase user data
                user_email = user.get('email', '').lower()
                
                # Map to SLUGGER cognito_user_id
                slugger_user_id = email_to_cognito.get(user_email)
                
                if not slugger_user_id:
                    unmapped_users.append(user_email)
                    MigrationLogger.warning(f"No SLUGGER user found for email: {user_email}")
                    continue
                
                # Map old team_id to new team_id
                old_team_id = user.get('team_id')
                new_team_id = team_mapping.get(old_team_id) if old_team_id else None
                
                self.cursor.execute("""
                    INSERT INTO clubhouse_users 
                    (slugger_user_id, user_name, user_role, team_id, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    slugger_user_id,
                    user.get('user_name'),
                    user.get('user_role'),
                    new_team_id,
                    user.get('created_at', datetime.now())
                ))
                
                new_id = self.cursor.fetchone()['id']
                old_id = user.get('id')
                mapping[old_id] = new_id
                
            except Exception as e:
                MigrationLogger.error(f"Failed to migrate user {user.get('user_name')}: {e}")
        
        self.conn.commit()
        
        if unmapped_users:
            MigrationLogger.warning(f"Unmapped users ({len(unmapped_users)}): {unmapped_users}")
        
        MigrationLogger.success(f"Migrated {len(mapping)} users")
        return mapping
    
    def migrate_tasks(self, tasks_data: List[Dict], user_mapping: Dict):
        """Migrate tasks table"""
        MigrationLogger.info(f"Migrating {len(tasks_data)} tasks...")
        migrated = 0
        
        for task in tasks_data:
            try:
                old_user_id = task.get('user_id')
                new_user_id = user_mapping.get(old_user_id)
                
                if not new_user_id:
                    MigrationLogger.warning(f"Skipping task - user not found: {old_user_id}")
                    continue
                
                self.cursor.execute("""
                    INSERT INTO clubhouse_tasks 
                    (user_id, task_name, task_description, task_complete, 
                     task_category, task_type, task_date, task_time, 
                     is_repeating, repeating_day, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    new_user_id,
                    task.get('task_name'),
                    task.get('task_description'),
                    task.get('task_complete', False),
                    task.get('task_category'),
                    task.get('task_type'),
                    task.get('task_date'),
                    task.get('task_time'),
                    task.get('is_repeating', False),
                    task.get('repeating_day'),
                    task.get('created_at', datetime.now())
                ))
                migrated += 1
                
            except Exception as e:
                MigrationLogger.error(f"Failed to migrate task: {e}")
        
        self.conn.commit()
        MigrationLogger.success(f"Migrated {migrated} tasks")
    
    def migrate_games(self, games_data: List[Dict], team_mapping: Dict) -> Dict[int, int]:
        """Migrate games table"""
        MigrationLogger.info(f"Migrating {len(games_data)} games...")
        mapping = {}
        
        for game in games_data:
            try:
                old_home_id = game.get('home_team_id')
                old_away_id = game.get('away_team_id')
                
                new_home_id = team_mapping.get(old_home_id)
                new_away_id = team_mapping.get(old_away_id)
                
                if not new_home_id or not new_away_id:
                    MigrationLogger.warning(f"Skipping game - teams not found")
                    continue
                
                self.cursor.execute("""
                    INSERT INTO clubhouse_games 
                    (home_team_id, away_team_id, date, time, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    new_home_id,
                    new_away_id,
                    game.get('date'),
                    game.get('time'),
                    game.get('created_at', datetime.now())
                ))
                
                new_id = self.cursor.fetchone()['id']
                old_id = game.get('id')
                mapping[old_id] = new_id
                
            except Exception as e:
                MigrationLogger.error(f"Failed to migrate game: {e}")
        
        self.conn.commit()
        MigrationLogger.success(f"Migrated {len(mapping)} games")
        return mapping
    
    def migrate_meals(self, meals_data: List[Dict], game_mapping: Dict) -> Dict[int, int]:
        """Migrate meals table"""
        MigrationLogger.info(f"Migrating {len(meals_data)} meals...")
        mapping = {}
        
        for meal in meals_data:
            try:
                old_game_id = meal.get('game_id')
                new_game_id = game_mapping.get(old_game_id)
                
                if not new_game_id:
                    MigrationLogger.warning(f"Skipping meal - game not found")
                    continue
                
                self.cursor.execute("""
                    INSERT INTO clubhouse_meals 
                    (game_id, pre_game_snack, post_game_meal, created_at)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                """, (
                    new_game_id,
                    meal.get('pre_game_snack'),
                    meal.get('post_game_meal'),
                    meal.get('created_at', datetime.now())
                ))
                
                new_id = self.cursor.fetchone()['id']
                old_id = meal.get('id')
                mapping[old_id] = new_id
                
            except Exception as e:
                MigrationLogger.error(f"Failed to migrate meal: {e}")
        
        self.conn.commit()
        MigrationLogger.success(f"Migrated {len(mapping)} meals")
        return mapping
    
    def migrate_inventory(self, inventory_data: List[Dict], team_mapping: Dict, meal_mapping: Dict):
        """Migrate inventory table"""
        MigrationLogger.info(f"Migrating {len(inventory_data)} inventory items...")
        migrated = 0
        
        for item in inventory_data:
            try:
                old_team_id = item.get('team_id')
                old_meal_id = item.get('meal_id')
                
                new_team_id = team_mapping.get(old_team_id) if old_team_id else None
                new_meal_id = meal_mapping.get(old_meal_id) if old_meal_id else None
                
                self.cursor.execute("""
                    INSERT INTO clubhouse_inventory 
                    (team_id, meal_id, inventory_type, inventory_item, 
                     current_stock, required_stock, unit, purchase_link, 
                     note, price_per_unit, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    new_team_id,
                    new_meal_id,
                    item.get('inventory_type'),
                    item.get('inventory_item'),
                    item.get('current_stock'),
                    item.get('required_stock'),
                    item.get('unit'),
                    item.get('purchase_link'),
                    item.get('note'),
                    item.get('price_per_unit'),
                    item.get('created_at', datetime.now())
                ))
                migrated += 1
                
            except Exception as e:
                MigrationLogger.error(f"Failed to migrate inventory item: {e}")
        
        self.conn.commit()
        MigrationLogger.success(f"Migrated {migrated} inventory items")
    
    def verify_migration(self):
        """Verify migration results"""
        MigrationLogger.info("Verifying migration...")
        
        tables = ['clubhouse_teams', 'clubhouse_users', 'clubhouse_tasks', 
                  'clubhouse_games', 'clubhouse_meals', 'clubhouse_inventory']
        
        for table in tables:
            self.cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
            count = self.cursor.fetchone()['count']
            MigrationLogger.info(f"{table}: {count} rows")


def main():
    """Main migration workflow"""
    print("\n" + "="*70)
    print("ClubhouseWidget: Supabase to Aurora Migration")
    print("="*70 + "\n")
    
    # Step 1: Export from Supabase
    MigrationLogger.info("Step 1: Exporting data from Supabase")
    exporter = SupabaseExporter(SUPABASE_PROJECT_REF)
    
    # Check if SUPABASE_DB_URL is set
    if not os.getenv('SUPABASE_DB_URL'):
        MigrationLogger.error("SUPABASE_DB_URL environment variable not set")
        print("\nPlease set the Supabase database URL:")
        print("export SUPABASE_DB_URL='postgresql://postgres:[YOUR-PASSWORD]@db.esmuegorbzltpkpmnxzu.supabase.co:5432/postgres'")
        print("\nYou can find this in your Supabase project settings > Database > Connection string")
        sys.exit(1)
    
    # Export all tables
    teams_data = exporter.export_table_to_json('teams')
    users_data = exporter.export_table_to_json('users')
    tasks_data = exporter.export_table_to_json('tasks')
    games_data = exporter.export_table_to_json('games')
    meals_data = exporter.export_table_to_json('meals')
    inventory_data = exporter.export_table_to_json('inventory')
    
    if not any([teams_data, users_data, tasks_data, games_data, meals_data, inventory_data]):
        MigrationLogger.error("No data exported from Supabase. Please check connection.")
        sys.exit(1)
    
    # Step 2: Connect to Aurora and migrate
    MigrationLogger.info("\nStep 2: Connecting to Aurora PostgreSQL")
    migrator = AuroraMigrator(AURORA_CONFIG)
    migrator.connect()
    
    try:
        # Build user mapping
        email_to_cognito = migrator.get_slugger_user_mapping()
        
        # Migrate in dependency order
        MigrationLogger.info("\nStep 3: Migrating data (respecting foreign keys)")
        
        team_mapping = migrator.migrate_teams(teams_data)
        user_mapping = migrator.migrate_users(users_data, team_mapping, email_to_cognito)
        migrator.migrate_tasks(tasks_data, user_mapping)
        game_mapping = migrator.migrate_games(games_data, team_mapping)
        meal_mapping = migrator.migrate_meals(meals_data, game_mapping)
        migrator.migrate_inventory(inventory_data, team_mapping, meal_mapping)
        
        # Verify
        MigrationLogger.info("\nStep 4: Verification")
        migrator.verify_migration()
        
        print("\n" + "="*70)
        MigrationLogger.success("Migration completed successfully!")
        print("="*70 + "\n")
        
    except Exception as e:
        MigrationLogger.error(f"Migration failed: {e}")
        migrator.conn.rollback()
        sys.exit(1)
    
    finally:
        migrator.close()


if __name__ == '__main__':
    main()
