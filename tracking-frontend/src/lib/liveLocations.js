import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'http://localhost:8080/ws';

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
