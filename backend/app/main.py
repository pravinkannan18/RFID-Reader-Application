# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .database import init_db, add_binding, get_bindings, add_tracking, get_trackings, get_packet_status
from .websocket_manager import ConnectionManager
import uvicorn

# Data models for request bodies
class RFIDScanRequest(BaseModel):
    epc: str
    device_id: str = "RFID_SCANNER"

class WeightReadingRequest(BaseModel):
    weight: float
    device_id: str = "WEIGHT_SENSOR"

app = FastAPI()

# Add CORS middleware for frontend on different port
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001",
        "http://192.168.29.68:*",
        "http://192.168.29.68"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
init_db()

# WebSocket manager for connections
manager = ConnectionManager()

# Note: Frontend is now a separate Next.js application running on port 3000
# Static file mounting is no longer needed

@app.get("/")
async def root():
    return {"message": "RFID Application Backend"}

# API to add binding (Loan ID to EPC)
@app.post("/bind")
async def bind_loan_to_epc(loan_id: str = Query(...), epc: str = Query(...)):
    add_binding(loan_id, epc)
    return {"status": "bound", "loan_id": loan_id, "epc": epc}

# API to get all bindings
@app.get("/bindings")
async def list_bindings():
    return get_bindings()

# API to add tracking event
@app.post("/track")
async def track_epc(epc: str = Query(...), reader_id: str = Query(...)):
    add_tracking(epc, reader_id)
    return {"status": "tracked", "epc": epc, "reader_id": reader_id}

# API to get trackings
@app.get("/trackings")
async def list_trackings():
    return get_trackings()

# API to get packet status (timeline with onboarding and vault times)
@app.get("/packet-status")
async def list_packet_status():
    """
    Returns all packets with their timeline:
    - packet_id: Loan ID
    - epc: RFID tag
    - onboarding_time: When EPC was bound
    - vault_entry_time: First detection on tracking page
    - vault_out_time: Most recent detection
    """
    return get_packet_status()

# API to mark tag as exited/out when timer expires
@app.post("/api/v1/tag-out")
async def mark_tag_out(epc: str = Query(...)):
    """
    Called when vault entry timeout expires - records tag as having left the vault
    """
    add_tracking(epc, "esp_timeout")
    print(f"✓ Tag timeout recorded - EPC: {epc}")
    return {
        "status": "marked_out",
        "epc": epc,
        "message": "Tag marked as exited"
    }

# API for RFID Scanner (v1 endpoint - hardware devices)
@app.post("/api/v1/rfid/scan")
async def rfid_scan(request: RFIDScanRequest):
    """
    Endpoint for RFID scanners to send scan data via JSON body:
    {
        "epc": "sample_epc_value",
        "device_id": "RFID_SCANNER"
    }
    """
    add_tracking(request.epc, request.device_id)
    # Broadcast to WebSocket clients with device info
    broadcast_message = f"TRACK:{request.epc}:{request.device_id}"
    await manager.broadcast(broadcast_message)
    print(f"RFID Scan: EPC={request.epc}, Device={request.device_id}")
    return {
        "status": "success",
        "epc": request.epc,
        "device_id": request.device_id,
        "message": "RFID scan recorded"
    }

# API for Weight Reader (v1 endpoint - hardware devices)
@app.post("/api/v1/weight/reading")
async def weight_reading(weight: float = Query(...), device_id: str = Query(None)):
    """
    Endpoint for weight reading devices to send weight data
    """
    # Store weight reading (you can expand database to store this)
    print(f"Weight reading from {device_id}: {weight}")
    # Broadcast to WebSocket clients if needed
    await manager.broadcast(f"WEIGHT:{weight}")
    return {
        "status": "success",
        "weight": weight,
        "device_id": device_id or "WEIGHT_SENSOR",
        "message": "Weight reading recorded"
    }

# API for Weight Device Commands (v1 endpoint)
@app.get("/api/v1/weight/command")
async def weight_command(device_id: str = Query(...)):
    """
    Endpoint for weight devices to fetch commands
    """
    return {
        "device_id": device_id,
        "command": "continue",
        "status": "active"
    }

# WebSocket for real-time RFID data (from RPi/UART and ESP)
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            
            # Parse TRACK messages: TRACK:epc:device_id
            if data.startswith('TRACK:'):
                parts = data.split(':')
                if len(parts) >= 3:
                    epc = parts[1].strip()
                    device_id = parts[2].strip()
                    # Save to database
                    add_tracking(epc, device_id)
                    print(f"✓ WebSocket recording - EPC: {epc}, Device: {device_id}")
            
            # Broadcast received data (e.g., EPC from readers)
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)