import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";
import type { IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

export interface QuizEvent {
  event: string;
  lobby?: Event;
}

export const useQuizSocket = (lobbyId?: string) => {
  const [quizEvent, setQuizEvent] = useState<QuizEvent | null>(null);

  useEffect(() => {
    if (!lobbyId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS("http://localhost:8080/ws"),
      onConnect: () => {
        client.subscribe(`/topic/lobby/${lobbyId}`, (message: IMessage) => {
          const data = JSON.parse(message.body);
          setQuizEvent(data);
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
