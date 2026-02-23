# backend/rpi_uart_reader.py
# This script runs on RPi to read UART RFID and send to backend via WebSocket
# Install websockets: pip install websockets
import serial
import asyncio
import websockets

# UART setup for first RFID
ser = serial.Serial('/dev/ttyUSB0', 115200, timeout=1)  # Adjust port as needed

async def send_to_backend(epc):
    uri = "ws://localhost:8000/ws"  # Adjust to your backend IP/port
    async with websockets.connect(uri) as websocket:
        await websocket.send(f"EPC:{epc}")

def read_uart():
    while True:
        if ser.in_waiting > 0:
            data = ser.readline().decode('utf-8').strip()
            if data:  # Assuming data is EPC hex
                asyncio.run(send_to_backend(data))

if __name__ == "__main__":
    read_uart()