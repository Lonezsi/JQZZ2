import React, { createContext, useCallback, useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";
import type { IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { API_BASE_URL } from "../services/api";
import { useAuth } from "./AuthContext";

interface WebSocketContextType {
  client: Client | null;
  connected: boolean;
  subscribe: (
    destination: string,
    callback: (msg: IMessage) => void,
  ) => StompSubscription | undefined;
}

// eslint-disable-next-line react-refresh/only-export-components
export const WebSocketContext = createContext<WebSocketContextType>({
  client: null,
  connected: false,
  subscribe: () => undefined,
});

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const userId = user?.id;
  const [client, setClient] = useState<Client | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const stompClient = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws`),
      // lets the backend track presence: online while any tab is connected
      connectHeaders: userId ? { userId } : {},
      reconnectDelay: 3000,
      onConnect: () => setConnected(true),
      onWebSocketClose: () => setConnected(false),
      onStompError: (frame) => console.error("STOMP error", frame.headers.message),
    });
    stompClient.activate();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient(stompClient);

    return () => {
      setConnected(false);
      stompClient.deactivate();
    };
  }, [userId]);

  // Changes identity whenever the connection (re)opens, so subscribers re-run
  // their effects and resubscribe after a reconnect.
  const subscribe = useCallback(
    (destination: string, callback: (msg: IMessage) => void) => {
      if (client && connected && client.connected) {
        return client.subscribe(destination, callback);
      }
      return undefined;
    },
    [client, connected],
  );

  return (
    <WebSocketContext.Provider value={{ client, connected, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWebSocket = () => React.useContext(WebSocketContext);
