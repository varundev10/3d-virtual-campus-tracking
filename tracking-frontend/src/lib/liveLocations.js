import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'http://localhost:8080/ws';

// The server authenticates the STOMP CONNECT frame with the same JWT used for REST calls
// and only lets admins subscribe to /topic/locations.
export function connectLiveLocations(onMessage, onStatus, token) {
  const client = new Client({
    reconnectDelay: 4000,
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    webSocketFactory: () => new SockJS(WS_BASE_URL),
    onConnect: () => {
      onStatus('connected');
      client.subscribe('/topic/locations', (message) => {
        try {
          onMessage(JSON.parse(message.body));
        } catch {
          onMessage({ raw: message.body });
        }
      });
    },
    onDisconnect: () => onStatus('disconnected'),
    onStompError: () => onStatus('error'),
    onWebSocketError: () => onStatus('error'),
  });

  client.activate();

  return () => {
    client.deactivate();
  };
}
