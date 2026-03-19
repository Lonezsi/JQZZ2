import { useEffect, useContext } from "react";
import { WebSocketContext } from "../contexts/WebSocketContext";

export const useWebSocket = (
  destination: string,
  callback: (msg: object) => void,
) => {
  const { subscribe } = useContext(WebSocketContext);

  useEffect(() => {
    if (!subscribe) return;
    const subscription = subscribe(destination, (message) => {
      const body = JSON.parse(message.body);
      callback(body);
    });
    return () => subscription?.unsubscribe();
  }, [destination, callback, subscribe]);
};
