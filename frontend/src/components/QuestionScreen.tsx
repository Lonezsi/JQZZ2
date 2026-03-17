import { useEffect, useState } from "react";
import useGameStore from "../store/gameStore";
import api from "../api/client";

export default function QuestionScreen() {
  const action = useGameStore((s) => s.currentAction);
  const lobbyId = useGameStore((s) => s.lobbyId);

  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitAnswer = async (questionId: number, answerId: number) => {
    if (!lobbyId) return;
    if (submitted) return;
    setSelected(answerId);
    try {
      await api.post(`/game/${lobbyId}/answer`, {
        questionId,
        answerId,
      });
      setSubmitted(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  if (!action?.question) return <div>No question</div>;

  const q = action.question;

  useEffect(() => {
    // reset selection when a new action/question arrives
    setSelected(null);
    setSubmitted(false);
  }, [action?.orderIndex, action?.question?.id]);

  return (
    <div className="p-6 rounded-lg shadow-lg bg-white">
      <h2 className="text-3xl mb-4">{q.text}</h2>
      {q.imageUrl && (
        <img src={q.imageUrl} alt="question" className="mb-4 max-w-full" />
      )}

      <div className="grid grid-cols-2 gap-4">
        {q.answers?.map((a) => {
          const isSelected = selected === a.id;
          return (
            <button
              key={a.id}
              onClick={() => submitAnswer(q.id, a.id)}
              disabled={submitted}
              className={`p-4 rounded-lg text-xl focus:outline-none transition-colors ${
                submitted
                  ? isSelected
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600 cursor-not-allowed"
                  : isSelected
                    ? "bg-indigo-700 text-white"
                    : "bg-indigo-600 text-white"
              }`}
            >
              {a.text}
            </button>
          );
        })}
      </div>

      {submitted && (
        <div className="mt-4 text-center text-green-700">
          Answer submitted! Waiting for results...
        </div>
      )}
    </div>
  );
}
