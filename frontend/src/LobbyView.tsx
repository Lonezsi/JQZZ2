import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useQuizSocket } from "./hooks/useQuizSocket";
import type { Lobby } from "./hooks/useQuizSocket";
import { API_ENDPOINT } from "./config/api";

const LobbyView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const quizEvent = useQuizSocket(id);

  useEffect(() => {
    if (!id) return;
    axios
      .get<Lobby>(`${API_ENDPOINT}/lobbies/${id}`)
      .then((res) => setLobby(res.data))
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    if (quizEvent?.lobby) {
      // Safe cast through unknown
      const updatedLobby = quizEvent.lobby as unknown as Lobby;
      setTimeout(() => setLobby(updatedLobby), 0);
    }
  }, [quizEvent]);

  const handleAdminAction = async (action: string) => {
    if (!id) return;
    await axios.post(`${API_ENDPOINT}/quiz/${id}/action`, { action });
  };

  if (!lobby) return <div>Loading...</div>;

  return (
    <div className="container paper-bg">
      <h1>Lobby: {lobby.name}</h1>
      <p>Status: {lobby.status}</p>

      <div className="admin-controls">
        <button onClick={() => handleAdminAction("start")} className="s-button">
          Start Quiz
        </button>
        <button
          onClick={() => handleAdminAction("next_question")}
          className="s-button"
        >
          Next Question
        </button>
      </div>

      <button onClick={() => navigate("/")} className="s-button">
        Leave Lobby
      </button>
    </div>
  );
};

export default LobbyView;
