import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useQuizSocket } from "./hooks/useQuizSocket";
import type { Lobby, QuizEvent } from "./hooks/useQuizSocket";
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

      {/* Script runner panel (real runner via backend) */}
      <RealRunnerPanel quizEvent={quizEvent} lobbyId={id} />

      <button onClick={() => navigate("/")} className="s-button">
        Leave Lobby
      </button>
    </div>
  );
};

// --- Real runner panel that uses backend script runner via STOMP events ---
type ScriptQuestionPayload = {
  questionId?: string;
  question?: {
    text?: string;
    imageUrl?: string;
    elaborationText?: string;
    elaborationImageUrl?: string;
  };
  time?: number;
};

type ScriptElaborationPayload = {
  questionId?: string;
  text?: string;
  image?: string;
  time?: number;
};

type ScriptResultsPayload = {
  questionId?: string;
  results?: {
    answers?: { text: string; value: number }[];
    winner?: { text: string; value?: number };
  };
  time?: number;
};

type ScriptPayload =
  | ScriptQuestionPayload
  | ScriptElaborationPayload
  | ScriptResultsPayload
  | Record<string, unknown>;

function RealRunnerPanel({
  quizEvent,
  lobbyId,
}: {
  quizEvent: QuizEvent | null;
  lobbyId?: string | undefined;
}) {
  const [current, setCurrent] = useState<ScriptPayload | null>(null);

  useEffect(() => {
    if (quizEvent && quizEvent.event === "script_event") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrent((quizEvent.payload ?? null) as ScriptPayload);
    }
  }, [quizEvent]);

  const sendNext = async () => {
    if (!lobbyId) return;
    try {
      await axios.post(`${API_ENDPOINT}/quiz/${lobbyId}/action`, {
        action: "next",
      });
    } catch (e) {
      console.error(e);
    }
  };

  const renderEvent = () => {
    if (!current) return <p>No event yet</p>;

    // Heuristics based on payload shape
    const q = (current as ScriptQuestionPayload | null)?.question;
    if (q) {
      return (
        <div>
          <h4>Question: {q.text}</h4>
          {q.imageUrl && (
            <img
              src={q.imageUrl}
              alt="question"
              style={{ maxWidth: "200px" }}
            />
          )}
          <p>Time: {(current as ScriptQuestionPayload)?.time ?? 0} seconds</p>
        </div>
      );
    }
    const results = (current as ScriptResultsPayload | null)?.results;
    if (results) {
      return (
        <div>
          <h5>Results</h5>
          {results.answers?.map((a, i) => (
            <p key={i}>
              {a.text} → {a.value}
            </p>
          ))}
        </div>
      );
    }

    // Fallback treat as elaboration
    return (
      <div>
        <h5>Elaboration: {(current as ScriptElaborationPayload)?.text}</h5>
        {(current as ScriptElaborationPayload | null)?.image && (
          <img
            src={
              (current as ScriptElaborationPayload).image?.includes(":")
                ? `https://example.com/private/${(current as ScriptElaborationPayload).image!.replace(":", "/")}`
                : `https://example.com/public/${(current as ScriptElaborationPayload).image}`
            }
            alt="elaboration"
            style={{ maxWidth: "200px" }}
          />
        )}
        <p>Time: {(current as ScriptElaborationPayload)?.time ?? 0} seconds</p>
      </div>
    );
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 6,
      }}
    >
      <h3>Script Runner</h3>
      {renderEvent()}
      <div style={{ marginTop: 8 }}>
        <button
          onClick={sendNext}
          style={{ marginRight: 8 }}
          className="s-button"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default LobbyView;
