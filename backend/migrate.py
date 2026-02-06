"""
Migration script to create a default zone from existing configuration
Run this once after upgrading to multi-zone backend
"""
import sqlite3
import uuid

DB_PATH = "../rfid.db"

def migrate_to_multizone():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Check if zones table exists and has data
    cur.execute("SELECT COUNT(*) FROM zones")
    zone_count = cur.fetchone()[0]
    
    if zone_count == 0:
        # Create default zone
        default_zone_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO zones (id, name, reader_ip, reader_port, timeout, mapped_zone_id, enabled, simulation_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (default_zone_id, "Default Zone", "192.168.29.67", 2189, 8.0, None, 1, 0))
        
        conn.commit()
        print(f"✅ Created default zone: {default_zone_id}")
        print(f"   Name: Default Zone")
        print(f"   IP: 192.168.29.67")
        print(f"   Timeout: 8.0 seconds")
    else:
        print(f"✅ Zones already exist ({zone_count} zones found)")
    
    conn.close()
    print("\n🎉 Migration complete!")

if __name__ == "__main__":
    migrate_to_multizone()
