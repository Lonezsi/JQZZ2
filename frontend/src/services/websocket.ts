import { Client } from "@stomp/stompjs";
import type { IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

class WebSocketService {
  private client: Client | null = null;

  connect(onConnect?: () => void, onError?: (error: string) => void) {
    this.client = new Client({
      webSocketFactory: () => new SockJS("http://localhost:8080/ws"),
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("WebSocket connected");
        onConnect?.();
      },
      onStompError: (frame) => {
        console.error("STOMP error", frame);
        onError?.(frame.headers["message"]);
      },
    });
    this.client.activate();
  }

  disconnect() {
    this.client?.deactivate();
  }

  subscribe(destination: string, callback: (message: IMessage) => void) {
    return this.client?.subscribe(destination, callback);
  }

  send(destination: string, body: object) {
    this.client?.publish({
      destination,
      body: JSON.stringify(body),
    });
  }
}

export const wsService = new WebSocketService();
