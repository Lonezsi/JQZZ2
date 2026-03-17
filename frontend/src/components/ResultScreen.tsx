import useGameStore from "../store/gameStore";
import Leaderboard from "./Leaderboard";

export default function ResultScreen() {
  const action = useGameStore((s) => s.currentAction);
  const q = action?.question;

  return (
    <div className="p-6 rounded-lg shadow-lg bg-white">
      <h3 className="text-2xl mb-2">Results</h3>
      {q ? (
        <div>
          <p className="text-lg">Correct answer shown on server</p>
          <p className="mt-2 font-semibold">{q.text}</p>
        </div>
      ) : (
        <p>No result data</p>
      )}
      <div className="mt-6">
        <Leaderboard />
      </div>
    </div>
  );
}
