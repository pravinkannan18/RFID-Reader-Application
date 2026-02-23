# backend/app/database.py
import sqlite3
import os
from datetime import datetime

DB_FILE = "rfid.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Create bindings table with onboarding_time
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bindings (
            id INTEGER PRIMARY KEY,
            loan_id TEXT UNIQUE,
            epc TEXT,
            onboarding_time TEXT
        )
    ''')
    
    # Create trackings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS trackings (
            id INTEGER PRIMARY KEY,
            epc TEXT,
            reader_id TEXT,
            timestamp TEXT
        )
    ''')
    
    # Check if onboarding_time column exists, if not add it
    cursor.execute("PRAGMA table_info(bindings)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'onboarding_time' not in columns:
        try:
            # Add the column without default first
            cursor.execute("ALTER TABLE bindings ADD COLUMN onboarding_time TEXT")
            # Update existing rows with current timestamp
            cursor.execute("UPDATE bindings SET onboarding_time = datetime('now') WHERE onboarding_time IS NULL")
            print("✓ Added onboarding_time column to bindings table")
        except sqlite3.OperationalError as e:
            print(f"Warning during migration: {e}")
    else:
        print("✓ onboarding_time column already exists")
    
    conn.commit()
    conn.close()
    print(f"✓ Database initialized: {DB_FILE}")

def add_binding(loan_id: str, epc: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("INSERT OR REPLACE INTO bindings (loan_id, epc, onboarding_time) VALUES (?, ?, ?)", 
                   (loan_id, epc, now))
    conn.commit()
    conn.close()

def get_bindings():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bindings")
    rows = cursor.fetchall()
    conn.close()
    return [{"loan_id": row[1], "epc": row[2]} for row in rows]

def add_tracking(epc: str, reader_id: str):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("INSERT INTO trackings (epc, reader_id, timestamp) VALUES (?, ?, ?)", 
                   (epc, reader_id, now))
    conn.commit()
    conn.close()

def get_trackings():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT epc, reader_id, timestamp FROM trackings ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    return [{
        "epc": row[0],
        "reader_id": row[1],
        "timestamp": row[2]
    } for row in rows]

def get_packet_status():
    """Get all packets with their onboarding and tracking timeline
    
    NOTE: Vault Entry Time and Vault Out Time are ONLY from ESP readers,
    RPi readings are ignored for vault tracking. Timeouts also count as out events.
    """
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Get all bindings with their onboarding times
    cursor.execute("SELECT loan_id, epc, COALESCE(onboarding_time, '') as onboarding_time FROM bindings ORDER BY COALESCE(onboarding_time, '') DESC")
    bindings = cursor.fetchall()
    
    packets = []
    for loan_id, epc, onboarding_time in bindings:
        # Get tracking info for this EPC - ONLY from ESP readers and timeouts, NOT from RPi
        # Filter to only include ESP reader data and timeout events
        cursor.execute("""
            SELECT timestamp FROM trackings 
            WHERE epc = ? AND (reader_id LIKE '%esp%' OR reader_id LIKE '%ESP%' OR reader_id LIKE '%timeout%' OR reader_id LIKE '%TIMEOUT%')
            ORDER BY timestamp ASC
        """, (epc,))
        tracking_rows = cursor.fetchall()
        
        vault_entry_time = None
        vault_out_time = None
        
        if tracking_rows:
            vault_entry_time = tracking_rows[0][0]  # First ESP detection
            vault_out_time = tracking_rows[-1][0]   # Latest ESP detection or timeout
        
        packets.append({
            "packet_id": loan_id,
            "epc": epc,
            "onboarding_time": onboarding_time if onboarding_time else None,
            "vault_entry_time": vault_entry_time,
            "vault_out_time": vault_out_time
        })
    
    conn.close()
    return packets