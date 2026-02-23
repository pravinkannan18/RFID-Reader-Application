# backend/esp_receiver.py
# This script runs on laptop to receive from ESP32 and forward to WebSocket
# It listens on port 5005 as per ESP code
import socket
import time
import asyncio
import websockets
import threading

host = "esp32_1.local"
port = 5005
ws_uri = "ws://localhost:8000/ws"
device_id = "esp32-reader-1"

def extract_epc(raw_hex):
    """
    Extracts the 12-byte (24-char) EPC from the RCP packet.
    The EPC starts at index 24 and ends at index 48.
    """
    # Remove any headers if the ESP32 is still sending "RFID Data: "
    clean_hex = raw_hex.replace("RFID Data: ", "").strip()
    
    # Check if packet length is sufficient (Header + EPC + Footer)
    if len(clean_hex) >= 48 and clean_hex.startswith("5246"):
        epc = clean_hex[24:48]
        return epc
    return None

async def send_to_websocket(epc):
    """
    Send EPC data directly to backend WebSocket
    """
    try:
        async with websockets.connect(ws_uri) as websocket:
            message = f"TRACK:{epc}:{device_id}"
            await websocket.send(message)
            print(f"✓ Sent to WebSocket - EPC: {epc} from {device_id}")
    except Exception as e:
        print(f"✗ Failed to send to WebSocket: {e}")

def send_epc_async(epc):
    """
    Wrapper to send EPC asynchronously
    """
    asyncio.run(send_to_websocket(epc))

def start_client():
    while True:
        try:
            try:
                ip = socket.gethostbyname(host)
                print(f"Resolved {host} to {ip}")
            except socket.gaierror:
                print(f"Could not find {host}. Retrying in 5 seconds...")
                time.sleep(5)
                continue

            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(20)
            s.connect((ip, port))
            print(f"Connected to ESP32 at {ip}:{port}! Listening...")

            f = s.makefile('r')

            while True:
                line = f.readline()
                if not line:
                    break
                
                clean_data = line.strip()
                if clean_data == "PING" or not clean_data:
                    continue 
                
                # Extract EPC from raw hex data
                epc_id = extract_epc(clean_data)
                
                if epc_id:
                    print(f"✓ Decoded EPC: {epc_id}")
                    # Send to WebSocket in a separate thread to avoid blocking
                    thread = threading.Thread(target=send_epc_async, args=(epc_id,))
                    thread.daemon = True
                    thread.start()
                else:
                    # Optional: print raw data if it doesn't match expected EPC format
                    print(f"Raw Data (No EPC extracted): {clean_data}")

        except Exception as e:
            print(f"Status: {e}. Reconnecting in 2 seconds...")
            time.sleep(2)
        finally:
            try:
                s.close()
            except:
                pass

if __name__ == "__main__":
    print("ESP32 RFID Receiver Started")
    print(f"Connecting to {host}:{port}")
    print(f"Broadcasting to WebSocket: {ws_uri}")
    start_client()