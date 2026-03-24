import React, { createContext, useEffect, useState, useRef } from "react";
import { Client } from "@stomp/stompjs";
import type { IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";

interface WebSocketContextType {
  client: Client | null;
  subscribe: (
    destination: string,
    callback: (msg: IMessage) => void,
  ) => StompSubscription | undefined;
}

// eslint-disable-next-line react-refresh/only-export-components
export const WebSocketContext = createContext<WebSocketContextType>({
  client: null,
  subscribe: () => undefined,
});

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [client, setClient] = useState<Client | null>(null);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const stompClient = new Client({
      webSocketFactory: () => new SockJS("http://127.0.0.1:8080/ws"),
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("WebSocket connected");
      },
    });
    stompClient.activate();
    clientRef.current = stompClient;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient(stompClient);

    return () => {
      stompClient.deactivate();
    };
  }, []);

  const subscribe = (
    destination: string,
    callback: (msg: IMessage) => void,
  ) => {
    return clientRef.current?.subscribe(destination, callback);
  };

  return (
    <WebSocketContext.Provider value={{ client, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWebSocket = () => React.useContext(WebSocketContext);
