import { useEffect, useState } from "react";
import type { GameState, GameTask } from "../../types/play";
import { playService } from "../../services/playService";

/** what only this player sees: fetched again whenever the question or the round changes */
export function useTask(game: GameState, me: string, wanted: boolean) {
  const [task, setTask] = useState<GameTask | null>(null);
  const q = game.question?.id;
  // telephone's turns and a ballot's rounds each hand out something new
  const round = game.telephone?.round ?? game.board?.round ?? 0;
  const ballots = game.board?.mode === "ballots";
  useEffect(() => {
    if (!wanted || !me) return;
    let gone = false;
    playService
      .task(game.code, me)
      .then((t) => !gone && setTask(t))
      .catch(() => !gone && setTask({}));
    return () => {
      gone = true;
    };
  }, [game.code, me, q, round, wanted]);
  // a task from another question or turn is no task at all (an empty one is just nothing to do)
  const stale =
    !!task &&
    task.question !== undefined &&
    (task.question !== q || ((!!game.telephone || ballots) && task.round !== undefined && task.round !== round));
  return stale ? null : task;
}
