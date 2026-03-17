import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import type { IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { WS_ENDPOINT } from "../config/api";
import { useGameStore } from "../store/gameStore";
import type { Action, Player } from "../store/gameStore";

export interface QuizEvent {
  event: string;
  action?: Action;
  lobby?: {
    id: number;
    name?: string;
    adminId?: number;
  };
  payload?: unknown;
  time?: number;
}

export const useQuizSocket = (lobbyId?: string) => {
  const [latestEvent, setLatestEvent] = useState<QuizEvent | null>(null);

  const setAction = useGameStore((s) => s.setAction);
  const setPlayers = useGameStore((s) => s.setPlayers);
  const setLobbyId = useGameStore((s) => s.setLobbyId);
  const setLobbyAdminId = useGameStore((s) => s.setLobbyAdminId);
  const setTimer = useGameStore((s) => s.setTimer);

  const lobbyAdminId = useGameStore((s) => s.lobbyAdminId);
  const currentUserId = useGameStore((s) => s.userId);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!lobbyId) return;

    setLobbyId(lobbyId);

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_ENDPOINT),
      reconnectDelay: 5000,

      onConnect: () => {
        console.log("Connected to WS");
        client.subscribe(`/lobby/${lobbyId}`, (message: IMessage) => {
          try {
            const data = JSON.parse(message.body) as QuizEvent;
            setLatestEvent(data);
          } catch (e) {
            console.error("Failed to parse WS message", e);
          }
        });
      },

      onStompError: (err) => {
        console.error("STOMP error", err);
      },
    });

    client.activate();

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      client.deactivate();
    };
  }, [
    lobbyId,
    setAction,
    setPlayers,
    setLobbyId,
    setLobbyAdminId,
    setTimer,
    lobbyAdminId,
    currentUserId,
  ]);

  return latestEvent;
};

export default useQuizSocket;
