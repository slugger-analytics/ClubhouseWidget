#!/usr/bin/env python3
"""
Supabase to Aurora Migration Script (API-based)
Uses Supabase REST API instead of direct database connection

Prerequisites:
- Python packages: psycopg2-binary, requests
- Supabase API credentials (URL + anon key)
"""

import os
import sys
import json
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from typing import Dict, List

AURORA_CONFIG = {
    'host': 'alpb-1.cluster-cx866cecsebt.us-east-2.rds.amazonaws.com',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'QETUO123$%^',
    'port': 5432
}

SUPABASE_URL = 'https://esmuegorbzltpkpmnxzu.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbXVlZ29yYnpsdHBrcG1ueHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NzE2MjksImV4cCI6MjA3OTI0NzYyOX0.iNNLMAZ6UsMFTUs7BVqTldgZgk5YGDPSMUKC3js1vKI'

class MigrationLogger:
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


class SupabaseAPIExporter:
    """Export data using Supabase REST API"""
    
    def __init__(self, url: str, anon_key: str):
        self.url = url.rstrip('/')
        self.headers = {
            'apikey': anon_key,
            'Authorization': f'Bearer {anon_key}',
            'Content-Type': 'application/json'
        }
    
    def export_table(self, table_name: str) -> List[Dict]:
        """Export all data from a table using REST API"""
        MigrationLogger.info(f"Exporting {table_name} via Supabase API...")
        
        try:
            endpoint = f"{self.url}/rest/v1/{table_name}"
            params = {
                'select': '*',
                'limit': 10000
            }
            
            response = requests.get(endpoint, headers=self.headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                MigrationLogger.success(f"Exported {len(data)} rows from {table_name}")
                return data
            else:
                MigrationLogger.error(f"Failed to export {table_name}: {response.status_code} - {response.text}")
                return []
                
        except Exception as e:
            MigrationLogger.error(f"Exception exporting {table_name}: {e}")
            return []
    
    def get_auth_users(self) -> List[Dict]:
        """
        Try to get auth users (may require service_role key)
        Falls back to getting users from the users table
        """
        MigrationLogger.info("Attempting to get user data...")
        
        try:
            endpoint = f"{self.url}/rest/v1/users"
            params = {'select': '*'}
            
            response = requests.get(endpoint, headers=self.headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                MigrationLogger.success(f"Retrieved {len(data)} users")
                return data
            else:
                MigrationLogger.warning(f"Could not access users table: {response.status_code}")
                return []
                
        except Exception as e:
            MigrationLogger.warning(f"Could not get users: {e}")
            return []


class AuroraMigrator:
    """Handles migration to Aurora PostgreSQL"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.conn = None
        self.cursor = None
    
    def connect(self):
        try:
            self.conn = psycopg2.connect(**self.config)
            self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            MigrationLogger.success("Connected to Aurora PostgreSQL")
        except Exception as e:
            MigrationLogger.error(f"Failed to connect to Aurora: {e}")
            sys.exit(1)
    
    def close(self):
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        MigrationLogger.info("Closed Aurora connection")
    
    def get_slugger_user_mapping(self) -> Dict[str, str]:
        """Create mapping: email -> cognito_user_id"""
        MigrationLogger.info("Building SLUGGER user email mapping...")
        
        try:
            self.cursor.execute("""
                SELECT email, cognito_user_id 
                FROM users 
                WHERE email IS NOT NULL
            """)
            rows = self.cursor.fetchall()
            
            mapping = {row['email'].lower().strip(): row['cognito_user_id'] for row in rows}
            MigrationLogger.success(f"Mapped {len(mapping)} SLUGGER users by email")
            return mapping
            
        except Exception as e:
            MigrationLogger.error(f"Failed to build user mapping: {e}")
            return {}
    
    def migrate_teams(self, teams_data: List[Dict]) -> Dict:
        """Migrate teams table"""
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
    
    def migrate_users(self, users_data: List[Dict], team_mapping: Dict, email_to_cognito: Dict) -> Dict:
        """Migrate users table with SLUGGER user mapping"""
        MigrationLogger.info(f"Migrating {len(users_data)} users...")
        mapping = {}
        unmapped_users = []
        
        for user in users_data:
            try:
                user_email = user.get('email', '').lower().strip()
                
                if not user_email:
                    MigrationLogger.warning(f"User has no email: {user.get('user_name')}")
                    continue
                
                slugger_user_id = email_to_cognito.get(user_email)
                
                if not slugger_user_id:
                    unmapped_users.append(user_email)
                    MigrationLogger.warning(f"No SLUGGER user found for: {user_email}")
                    continue
                
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
            MigrationLogger.warning(f"Unmapped users ({len(unmapped_users)}): {unmapped_users[:5]}...")
        
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
    
    def migrate_games(self, games_data: List[Dict], team_mapping: Dict) -> Dict:
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
    
    def migrate_meals(self, meals_data: List[Dict], game_mapping: Dict) -> Dict:
        """Migrate meals table"""
        MigrationLogger.info(f"Migrating {len(meals_data)} meals...")
        mapping = {}
        
        for meal in meals_data:
            try:
                old_game_id = meal.get('game_id')
                new_game_id = game_mapping.get(old_game_id)
                
                if not new_game_id:
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
            MigrationLogger.info(f"  {table}: {count} rows")


def main():
    print("\n" + "="*70)
    print("ClubhouseWidget: Supabase to Aurora Migration (API Method)")
    print("="*70 + "\n")
    
    MigrationLogger.info("Step 1: Exporting data from Supabase via REST API")
    exporter = SupabaseAPIExporter(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    teams_data = exporter.export_table('teams')
    users_data = exporter.export_table('user')  # Singular, not plural
    tasks_data = exporter.export_table('task')  # Singular, not plural
    games_data = exporter.export_table('games')
    meals_data = exporter.export_table('meals')
    inventory_data = exporter.export_table('inventory')
    
    if not any([teams_data, users_data, tasks_data, games_data, meals_data, inventory_data]):
        MigrationLogger.error("No data exported from Supabase. Check API credentials or table names.")
        sys.exit(1)
    
    MigrationLogger.info("\nStep 2: Connecting to Aurora PostgreSQL")
    migrator = AuroraMigrator(AURORA_CONFIG)
    migrator.connect()
    
    try:
        email_to_cognito = migrator.get_slugger_user_mapping()
        
        MigrationLogger.info("\nStep 3: Migrating data (respecting foreign keys)")
        
        team_mapping = migrator.migrate_teams(teams_data)
        user_mapping = migrator.migrate_users(users_data, team_mapping, email_to_cognito)
        migrator.migrate_tasks(tasks_data, user_mapping)
        game_mapping = migrator.migrate_games(games_data, team_mapping)
        meal_mapping = migrator.migrate_meals(meals_data, game_mapping)
        migrator.migrate_inventory(inventory_data, team_mapping, meal_mapping)
        
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
