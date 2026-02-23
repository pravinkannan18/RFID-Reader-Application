/**
 * WebSocket utility for real-time RFID data
 */

let ws: WebSocket | null = null;
let listeners: ((message: string) => void)[] = [];
let reconnectTimeout: NodeJS.Timeout | null = null;

export function initWebSocket() {
  if (typeof window === 'undefined') return null;
  
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    try {
      ws = new WebSocket('ws://localhost:8000/ws');
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
      };
      
      ws.onmessage = (event) => {
        if (event.data) {
          listeners.forEach(listener => listener(event.data));
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket closed, attempting reconnect...');
        ws = null;
        // Attempt to reconnect after 3 seconds
        reconnectTimeout = setTimeout(() => {
          initWebSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      return null;
    }
  }
  
  return ws;
}

export function addWebSocketListener(listener: (message: string) => void) {
  listeners.push(listener);
  initWebSocket();
  
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function getWebSocket() {
  return initWebSocket();
}
