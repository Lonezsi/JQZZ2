import useGameStore from "../store/gameStore";

export default function Leaderboard() {
  const players = useGameStore((s) => s.players.slice()).sort(
    (a, b) => b.score - a.score,
  );

  return (
    <div className="p-4 bg-gray-50 rounded">
      <h4 className="text-xl">🏆 Leaderboard</h4>
      <ol className="mt-2 list-decimal pl-5">
        {players.map((p) => (
          <li key={p.id} className="py-1">
            <strong>{p.name}</strong> — {p.score}
          </li>
        ))}
      </ol>
    </div>
  );
}
