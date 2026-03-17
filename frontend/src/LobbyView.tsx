import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import api from "./api/client";
import useQuizSocket from "./hooks/useQuizSocket";
import { API_ENDPOINT } from "./config/api";
import useGameStore, { type Action, type Player } from "./store/gameStore";
import WaitingScreen from "./components/WaitingScreen";
import QuestionScreen from "./components/QuestionScreen";
import AnswerLockedScreen from "./components/AnswerLockedScreen";
import ElaborationScreen from "./components/ElaborationScreen";
import ResultScreen from "./components/ResultScreen";

export interface Quiz {
  id: number;
  name: string;
  authorId: string;
  actions: Action[];
}

export interface Lobby {
  id: number;
  name: string;
  adminId?: number;
  currentActionIndex: number;
  time: number;
  players: Player[];
  quiz?: Quiz;
}

const LobbyView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quizEvent = useQuizSocket(id);
  const currentAction = useGameStore((s) => s.currentAction);
  const timer = useGameStore((s) => s.timer);
  const players = useGameStore((s) => s.players);
  const currentUserId = useGameStore((s) => s.userId);
  const setLobbyAdminId = useGameStore((s) => s.setLobbyAdminId);
  const setPlayers = useGameStore((s) => s.setPlayers);

  const isLobbyAdmin = Boolean(lobby?.adminId != null && currentUserId != null && lobby.adminId === currentUserId);

  useEffect(() => {
    if (!id) return;

    axios
      .get<Lobby>(`${API_ENDPOINT}/lobbies/${id}`)
      .then((res) => {
        setLobby(res.data);
        setLobbyAdminId(res.data.adminId);
        setPlayers(res.data.players ?? []);
      })
      .catch((err) => {
        console.error("Failed to load lobby", err);
        setError("Failed to load lobby data");
      });
  }, [id, setLobbyAdminId, setPlayers]);

  useEffect(() => {
    if (!quizEvent || !id) return;

    if (quizEvent.event === "quiz_started" && quizEvent.lobby) {
      const lobbyUpdate = quizEvent.lobby as Partial<Lobby>;

      setTimeout(() => {
        setLobby((prev) => ({
          ...(prev ?? {}),
          ...lobbyUpdate,
        } as Lobby));
      }, 0);

      if (lobbyUpdate.adminId != null) {
        setLobbyAdminId(lobbyUpdate.adminId);
      }

      const lobbyData = quizEvent.lobby as Partial<Lobby> & { players?: Player[] };
      if (Array.isArray(lobbyData.players)) {
        setPlayers(lobbyData.players);
      }
    }

    if (quizEvent.event === "players_update" && Array.isArray(quizEvent.payload)) {
      setPlayers(quizEvent.payload as Player[]);
    }

    if (quizEvent.event === "action" && quizEvent.action) {
      setTimeout(() => {
        setLobby((prev) =>
          prev
            ? {
                ...prev,
                currentActionIndex: prev.currentActionIndex + 1,
                time: quizEvent.action?.time ?? prev.time,
              }
            : prev
        );
      }, 0);
    }
  }, [quizEvent, id, setLobbyAdminId, setPlayers]);

  const startQuiz = async () => {
    if (!id) return;
    try {
      await api.post(`/game/${id}/start`);
    } catch (e) {
      console.error("Start quiz failed", e);
      setError("Could not start quiz");
    }
  };

  const nextAction = async () => {
    if (!id) return;
    try {
      await api.post(`/game/${id}/next`);
    } catch (e) {
      console.error("Next action failed", e);
      setError("Could not advance to next action");
    }
  };

  const renderPhaseScreen = () => {
    if (!currentAction) {
      return <WaitingScreen />;
    }

    switch (currentAction.phase) {
      case "WAITING":
        return <WaitingScreen />;
      case "QUESTION":
        return <QuestionScreen />;
      case "ANSWER":
        return <AnswerLockedScreen />;
      case "ELABORATION":
        return <ElaborationScreen />;
      case "RESULT":
        return <ResultScreen />;
      default:
        return (
          <div className="p-6 rounded-lg shadow-lg bg-white text-center">
            Unknown phase: {currentAction.phase}
          </div>
        );
    }
  };

  if (!lobby && !error) return <div>Loading lobby…</div>;
  if (error) return <div className="error">{error}</div>;
  if (!lobby) return <div>Lobby not found</div>;

  return (
    <div className="container paper-bg">
      <header className="lobby-header">
        <h1>Lobby: {lobby.name}</h1>
        <p>ID: {lobby.id}</p>
        <p>Admin: {lobby.adminId ?? "TBD"}</p>
        <p>Quiz progress: {lobby.currentActionIndex + 1}/{lobby.quiz?.actions?.length ?? "?"}</p>
        <p>Timer (s): {timer}</p>
      </header>

      <section className="lobby-players">
        <h2>Players ({players.length})</h2>
        {players.length === 0 ? (
          <p>No players joined yet.</p>
        ) : (
          <ul>
            {players.map((player) => (
              <li key={player.userId}>
                {player.name ?? player.userId}: {player.score} points
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lobby-action" style={{ marginTop: 16 }}>
        {renderPhaseScreen()}
      </section>

      <section className="admin-controls" style={{ marginTop: 16 }}>
        <button onClick={startQuiz} className="s-button" disabled={!isLobbyAdmin}>
          Start Quiz
        </button>
        <button onClick={nextAction} className="s-button" disabled={!isLobbyAdmin}>
          Next
        </button>
      </section>

      <button onClick={() => navigate("/")} className="s-button" style={{ marginTop: 12 }}>
        Leave Lobby
      </button>
    </div>
  );
};

export default LobbyView;
