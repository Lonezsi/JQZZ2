import { useEffect, useContext, useRef } from "react";
import { WebSocketContext } from "../contexts/WebSocketContext";

export const useWebSocket = <T = object>(
  destination: string,
  callback: (data: T) => void,
) => {
  const { subscribe } = useContext(WebSocketContext);

  // read through a ref so an inline callback doesn't resubscribe on every render
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const subscription = subscribe(destination, (message) => {
      try {
        const data = JSON.parse(message.body) as T;
        callbackRef.current(data);
      } catch (err) {
        console.error("Failed to parse WebSocket message", err);
      }
    });
    return () => {
      try {
        subscription?.unsubscribe();
      } catch {
        // connection already gone; the subscription died with it
      }
    };
  }, [destination, subscribe]);
};
