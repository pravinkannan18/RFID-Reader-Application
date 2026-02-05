import asyncio
import socket
import threading
import time
import sqlite3
import random
from datetime import datetime
from typing import Dict, List, Optional, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="RFID Presence Monitor API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configuration ---
class Settings:
    READER_IP: str = "192.168.29.201"
    READER_PORT: int = 2189
    MISSING_TIMEOUT: float = 8.0
    SIMULATION_MODE: bool = False  # Set to True if real connection fails

settings = Settings()

# --- Database Manager ---
class Database:
    def __init__(self, db_path="../rfid.db"): # Adjusted path for backend/ folder
        self.db_path = db_path

    def get_name(self, tag_id: str) -> str:
        try:
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute("CREATE TABLE IF NOT EXISTS rfid_names (id TEXT PRIMARY KEY, name TEXT)")
            cur.execute("SELECT name FROM rfid_names WHERE id = ?", (tag_id,))
            row = cur.fetchone()
            conn.close()
            return row[0] if row else "Unknown Asset"
        except Exception as e:
            print(f"DB Error: {e}")
            return tag_id
    
    def set_name(self, tag_id: str, name: str) -> bool:
        """Update or insert a tag name in the database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute("CREATE TABLE IF NOT EXISTS rfid_names (id TEXT PRIMARY KEY, name TEXT)")
            cur.execute("INSERT OR REPLACE INTO rfid_names (id, name) VALUES (?, ?)", (tag_id, name))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"DB Error setting name: {e}")
            return False

db = Database()

# --- Core Logic ---
class RFIDMonitor:
    def __init__(self):
        self.running = False
        self.connection_state = "disconnected" # disconnected, connecting, connected, failed
        self.sock: Optional[socket.socket] = None
        self.seen_tags: Dict[str, float] = {}  # tag_id -> timestamp
        self.latest_tags: List[str] = []       # Tags seen in the *last* read cycle
        
        self.lock = threading.Lock()
        self.thread: Optional[threading.Thread] = None
        self.logs: List[Dict] = []  # List of {time, msg, type}
        
        # State for simulation
        self.simulated_pool = [f"E2001000{i:04X}" for i in range(1, 15)]

    def log(self, msg, type="info"):
        t = datetime.now().strftime("%H:%M:%S")
        with self.lock:
            self.logs.append({"time": t, "msg": msg, "type": type})
            if len(self.logs) > 50: # Keep last 50 logs
                self.logs.pop(0)
        print(f"[{type.upper()}] {msg}")

    def start(self, ip=None):
        if self.running: return
        if ip: settings.READER_IP = ip
        
        self.running = True
        self.log(f"Starting monitor on {settings.READER_IP}...", "info")
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
        self.connection_state = "disconnected"
        self.log("Monitor stopped", "warn")
        with self.lock:
            self.seen_tags.clear()

    def _monitor_loop(self):
        while self.running:
            try:
                # 1. Try to connect
                if not settings.SIMULATION_MODE:
                    self.connection_state = "connecting"
                    self.log(f"Connecting to {settings.READER_IP}:{settings.READER_PORT}...", "info")
                    
                    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                        s.settimeout(2.0)
                        try:
                            s.connect((settings.READER_IP, int(settings.READER_PORT)))
                            self.connection_state = "connected"
                            self.log(f"Connected successfully to {settings.READER_IP}", "success")

                            # Read loop
                            while self.running:
                                s.sendall(b"READ\r\n")
                                
                                # Receive response
                                resp = ""
                                start_time = time.time()
                                while time.time() - start_time < 2.0: # Timeout for "completed message"
                                    try:
                                        chunk = s.recv(4096).decode('utf-8', errors='ignore')
                                        resp += chunk
                                        if "OK>" in chunk or "ERR>" in chunk:
                                            break
                                    except socket.timeout:
                                        break
                                    except Exception:
                                        break
                                
                                # Parse tags
                                current_read = []
                                lines = resp.splitlines()
                                now = time.time()
                                
                                with self.lock:
                                    for line in lines:
                                        tag = line.strip()
                                        if tag and not tag.startswith(('OK>', 'ERR>')):
                                            current_read.append(tag)
                                            if tag not in self.seen_tags:
                                                 name = db.get_name(tag)
                                                 # Async log for new tags isn't strictly necessary but helpful
                                                 # self.log(f"New tag: {tag} ({name})", "blue") 
                                            self.seen_tags[tag] = now
                                    
                                    self.latest_tags = current_read

                                time.sleep(0.4) # Polling rate

                        except Exception as e:
                            self.connection_state = "failed"
                            self.log(f"Connection failed: {e}", "error")
                            time.sleep(2.0) # Retry delay
                else:
                    # SIMULATION
                    self.connection_state = "connected"
                    if not self.latest_tags:
                         self.log("Simulation started - generating tags", "success")
                         
                    # Simulate random reads
                    now = time.time()
                    # 90% chance to see existing, 10% chance to lose one temporarily
                    visible = [t for t in self.simulated_pool if random.random() > 0.1]
                    
                    with self.lock:
                        for tag in visible:
                            self.seen_tags[tag] = now
                        self.latest_tags = visible
                    
                    time.sleep(0.5)

            except Exception as e:
                self.log(f"Monitor Loop Error: {e}", "error")
                self.connection_state = "failed"
                time.sleep(1.0)
                
    def get_status(self):
        now = time.time()
        with self.lock:
            # Check for missing
            active_tags = []
            missing_tags = []
            
            # Sort by most recently seen
            for tag, last_seen in self.seen_tags.items():
                age = now - last_seen
                name = db.get_name(tag)
                
                info = {
                    "id": tag,
                    "name": name,
                    "last_seen": last_seen,
                    "age_seconds": round(age, 1)
                }
                
                if age > settings.MISSING_TIMEOUT:
                    missing_tags.append(info)
                else:
                    active_tags.append(info)
            
            return {
                "connection_state": self.connection_state,
                "monitoring": self.running,
                "ip": settings.READER_IP,
                "active_count": len(active_tags),
                "missing_count": len(missing_tags),
                "active_tags": sorted(active_tags, key=lambda x: x['age_seconds']),
                "missing_tags": sorted(missing_tags, key=lambda x: x['age_seconds'], reverse=True),
                "logs": list(self.logs) # Send copy of logs
            }

monitor = RFIDMonitor()

# --- API Models ---
class SetNameReq(BaseModel):
    tag_id: str
    name: str

class ConfigReq(BaseModel):
    timeout: float
    ip: str = "192.168.29.201"
    simulation: bool = False

# --- Endpoints ---

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/config")
def update_config(req: ConfigReq):
    settings.MISSING_TIMEOUT = req.timeout
    settings.READER_IP = req.ip
    settings.SIMULATION_MODE = req.simulation
    
    # Always restart/start to apply changes immediately
    monitor.stop()
    monitor.start()
    
    return {"status": "updated", "config": req}

@app.post("/start")
def start_monitor():
    monitor.start()
    return {"status": "started"}

@app.post("/stop")
def stop_monitor():
    monitor.stop()
    return {"status": "stopped"}

@app.post("/tag/name")
def set_tag_name(req: SetNameReq):
    """Update the name of a tag"""
    success = db.set_name(req.tag_id, req.name)
    if success:
        return {"status": "success", "tag_id": req.tag_id, "name": req.name}
    else:
        raise HTTPException(status_code=500, detail="Failed to update tag name")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = monitor.get_status()
            await websocket.send_json(data)
            await asyncio.sleep(0.5) # Update frontend every 500ms
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WS Error: {e}")

if __name__ == "__main__":
    import uvicorn
    # Listen on 0.0.0.0 to allow external access if needed
    uvicorn.run(app, host="0.0.0.0", port=8000)
