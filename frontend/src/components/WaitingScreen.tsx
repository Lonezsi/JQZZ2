import useGameStore from "../store/gameStore";

export default function WaitingScreen() {
  const timer = useGameStore((s) => s.timer);
  const currentAction = useGameStore((s) => s.currentAction);

  return (
    <div className="p-6 rounded-lg shadow-lg bg-white">
      <h2 className="text-2xl mb-2">Next question starting in</h2>
      <div className="text-6xl font-bold">{timer}</div>
      {currentAction?.question?.text && (
        <p className="mt-4 text-gray-600">{currentAction.question.text}</p>
      )}
    </div>
  );
}
