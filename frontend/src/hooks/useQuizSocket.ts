import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";
import type { IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { WS_ENDPOINT } from "../config/api";

export interface QuizEvent {
  event: string;
  lobby?: Lobby;
}

export interface Lobby {
  id: number;
  name: string;
  status: string;
}

export const useQuizSocket = (lobbyId?: string) => {
  const [quizEvent, setQuizEvent] = useState<QuizEvent | null>(null);

  useEffect(() => {
    if (!lobbyId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_ENDPOINT),
      onConnect: () => {
        client.subscribe(`/topic/lobby/${lobbyId}`, (message: IMessage) => {
          const data = JSON.parse(message.body) as unknown;
          setQuizEvent(data as QuizEvent); // safe cast via unknown
        });
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [lobbyId]);

  return quizEvent;
};
