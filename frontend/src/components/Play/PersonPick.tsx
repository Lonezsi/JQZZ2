import React, { useState } from "react";
import type { GameState } from "../../types/play";
import type { Submission } from "../../services/playService";
import type { MyAnswer } from "./Answering";
import { Select } from "../common/Select";
import { modeOf } from "../../utils/questionTypes";
import { EntryFace } from "./Drawn";
import { useTask } from "./useTask";

/*
 * Picking someone in the game: "who's most likely to", or, with an earlier
 * vote behind it, who made the winning answer. The one who made it picks too,
 * so the "answered" bar on the big screen can't give them away.
 */

interface Props {
  game: GameState;
  me: string;
  mine: MyAnswer;
  submit: (answer: Submission) => Promise<boolean>;
  remember: (patch: MyAnswer) => void;
}

export const PersonPick: React.FC<Props> = ({ game, me, mine, submit, remember }) => {
  const q = game.question!;
  const task = useTask(game, me, true);
  const [picked, setPicked] = useState<string | null>(mine.person ?? null);
  const chosen = picked ?? (typeof task?.chosen === "string" ? task.chosen : "");
  const people = (q.people ?? []).filter((p) => p.id !== me);

  const pick = async (id: string) => {
    const before = picked;
    setPicked(id);
    if (await submit({ choices: [id] })) remember({ person: id });
    else setPicked(before);
  };

  return (
    <div className="jqzz-person">
      {q.entry?.image && <EntryFace game={game} e={{ key: "entry", image: q.entry.image }} />}
      {modeOf(q).score === "none" && <p className="jqzz-play-note">no points on this one</p>}
      {people.length === 0 ? (
        <p className="jqzz-play-note">nobody else is here to pick.</p>
      ) : (
        <Select
          value={chosen}
          options={people.map((p) => ({ value: p.id, label: p.name, text: p.name }))}
          onChange={pick}
          placeholder="pick someone"
          aria-label="who"
        />
      )}
      {task?.yours && <p className="jqzz-play-note">that's yours. pick someone anyway, so nobody can tell.</p>}
      {chosen && <p className="jqzz-play-note">locked in. you can still change it.</p>}
    </div>
  );
};
