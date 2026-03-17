import useGameStore from "../store/gameStore";

export default function ElaborationScreen() {
  const action = useGameStore((s) => s.currentAction);
  const q = action?.question;

  if (!q) return <div>No elaboration</div>;

  return (
    <div className="p-6 rounded-lg shadow-lg bg-white">
      <h3 className="text-2xl mb-2">Explanation</h3>
      <p className="text-lg">{q?.text}</p>
      {q?.imageUrl && (
        <img src={q.imageUrl} alt="elaboration" className="mt-4 max-w-full" />
      )}
    </div>
  );
}
