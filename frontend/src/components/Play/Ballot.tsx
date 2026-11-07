import React, { useState } from "react";
import type { GameState, GameTask } from "../../types/play";
import type { Submission } from "../../services/playService";
import type { MyAnswer } from "./Answering";
import { pickCount } from "../../utils/play";
import { Countdown } from "./PlayCommon";
import { EntryFace, Subject } from "./Drawn";
import { useTask } from "./useTask";

/*
 * Voting on an earlier question's answers, while the question is asked.
 * What's on this phone comes from the task, never from the shared view: with
 * a big room each player gets their own set, and nobody else may see it.
 */

interface Props {
  game: GameState;
  me: string;
  mine: MyAnswer;
  submit: (answer: Submission) => Promise<boolean>;
  remember: (patch: MyAnswer) => void;
  serverNow: () => number;
}

export const Ballot: React.FC<Props> = (props) => {
  const { game, me } = props;
  const task = useTask(game, me, true);
  const board = game.board;
  if (!board) return null;
  if (!task) return <p className="jqzz-play-note">getting your set...</p>;
  // a new round is a new set, so what was picked starts again with it
  return <BallotSet key={`${game.question?.id}:${board.round ?? 1}`} {...props} task={task} />;
};

const BallotSet: React.FC<Props & { task: GameTask }> = ({ game, mine, submit, remember, serverNow, task }) => {
  const board = game.board!;
  const ballots = board.mode === "ballots";
  const round = board.round ?? 1;
  const rounds = board.rounds ?? 1;
  const entries = task.ballot ?? [];
  const most = Math.max(1, task.picks ?? game.question?.picks ?? 1);
  // what this phone sent this round wins over what the server last said, which may be a moment behind
  const fromServer = Array.isArray(task.chosen) ? task.chosen : [];
  const sent = mine.choices && (!ballots || mine.ballotRound === round) ? mine.choices : fromServer;
  const [picked, setPicked] = useState<string[]>(sent.filter((k) => entries.some((e) => e.key === k)));
  const drawn = entries.some((e) => e.image);

  const tap = async (key: string) => {
    const before = picked;
    let next: string[];
    if (most === 1) next = [key];
    else if (picked.includes(key)) next = picked.filter((k) => k !== key);
    else next = [...picked, key];
    // over the limit, or taking back the last one: the server keeps a vote until it's replaced
    if (next.length > most || next.length === 0) return;
    setPicked(next);
    if (await submit({ choices: next })) remember({ choices: next, ballotRound: round });
    else setPicked(before);
  };

  const roundStrip = ballots && rounds > 1 && (
    <div className="jqzz-turn-head">
      <span className="jqzz-annot">
        round {round} of {rounds}
        {round < rounds ? " · a new set comes next" : ""}
      </span>
      {board.roundEndsAt && (
        <Countdown game={game} serverNow={serverNow} size={44} endsAt={board.roundEndsAt} seconds={board.roundSeconds} />
      )}
    </div>
  );

  if (entries.length === 0) {
    return (
      <div className="jqzz-ballot">
        {roundStrip}
        <p className="jqzz-play-note">nothing to vote on but your own.</p>
      </div>
    );
  }

  const fit = Math.min(most, entries.length);
  return (
    <div className="jqzz-ballot">
      {roundStrip}
      <p className="jqzz-play-note">
        {most === 1 ? "tap the one you like best. you can change it." : `pick up to ${most}. tap one again to take it back.`}
      </p>
      <div className={drawn ? "jqzz-gallery pick" : "jqzz-ballot-grid"}>
        {entries.map((e, i) => (
          <button
            key={e.key}
            className={`${drawn ? "jqzz-frame" : "jqzz-entry"}${picked.includes(e.key) ? " picked" : ""}`}
            style={{ "--i": i } as React.CSSProperties}
            onClick={() => tap(e.key)}
            aria-pressed={picked.includes(e.key)}
          >
            <EntryFace game={game} e={e} />
            <Subject about={e.about} />
          </button>
        ))}
      </div>
      {most > 1 && <p className="jqzz-play-note jqzz-pick-count">{pickCount(picked.length, fit)}</p>}
      {most === 1 && picked.length > 0 && <p className="jqzz-play-note">locked in. you can still change it.</p>}
      {ballots && (
        <p className="jqzz-play-note">
          your own set: {entries.length} of the {board.count} answers. everyone gets a different mix.
        </p>
      )}
    </div>
  );
};
