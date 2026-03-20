import { useEffect, useContext } from "react";
import { WebSocketContext } from "../contexts/WebSocketContext";

export const useWebSocket = <T = object>(
  destination: string,
  callback: (data: T) => void,
) => {
  const { subscribe } = useContext(WebSocketContext);

  useEffect(() => {
    if (!subscribe) return;
    const subscription = subscribe(destination, (message) => {
      try {
        const data = JSON.parse(message.body) as T;
        callback(data);
      } catch (err) {
        console.error("Failed to parse WebSocket message", err);
      }
    });
    return () => subscription?.unsubscribe();
  }, [destination, callback, subscribe]);
};
