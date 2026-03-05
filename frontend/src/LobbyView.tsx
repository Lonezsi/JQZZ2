import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useQuizSocket, QuizEvent } from "./hooks/useQuizSocket";

interface Lobby {
  id: number;
  name: string;
  status: string;
}

const LobbyView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const quizEvent = useQuizSocket(id);

  useEffect(() => {
    if (!id) return;
    axios
      .get<Lobby>(`http://localhost:8080/api/lobbies/${id}`)
      .then((res) => setLobby(res.data))
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    if (quizEvent) {
      console.log("Event received:", quizEvent);
      if (quizEvent.event === "quizStarted" && quizEvent.lobby) {
        setLobby(quizEvent.lobby);
      }
    }
  }, [quizEvent]);

  const handleAdminAction = async (action: string) => {
    if (!id) return;
    await axios.post(`http://localhost:8080/api/quiz/${id}/action`, { action });
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
