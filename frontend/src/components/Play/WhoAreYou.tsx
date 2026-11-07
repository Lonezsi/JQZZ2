import React, { useState } from "react";
import axios from "axios";
import type { GameState } from "../../types/play";
import { playService } from "../../services/playService";
import { errorMessage } from "../../services/api";
import { nameKey } from "../../utils/roster";

/*
 * Joining a game whose quiz says who's coming: you pick your name off the
 * list. The name only counts in this game; your account keeps its own.
 */

interface Props {
  game: GameState;
  me: string;
  /** joined (or renamed): the game as the server now has it */
  onJoined: (state: GameState) => void;
  /** the game said no for good (a 409): taken out, full, or started */
  onRefused: (message: string) => void;
  /** already in, changing who you are: a way back without changing */
  onCancel?: () => void;
}

export const WhoAreYou: React.FC<Props> = ({ game, me, onJoined, onRefused, onCancel }) => {
  const roster = game.roster!;
  const [joining, setJoining] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const mine = game.players.find((p) => p.id === me);

  // who has each name, leaving out yourself: your own name isn't taken from you
  const holders = (name: string) => game.players.filter((p) => p.id !== me && nameKey(p.name) === nameKey(name));
  const names = roster.names.map((n) => {
    const others = holders(n.name);
    return {
      name: n.name,
      taken: others.length > 0,
      away: others.length > 0 && others.every((p) => !p.online),
      yours: !!mine && nameKey(mine.name) === nameKey(n.name),
    };
  });
  const allTaken = roster.unique && names.every((n) => n.taken);

  const pick = async (name: string) => {
    setJoining(name);
    setProblem(null);
    try {
      onJoined(await playService.join(game.code, me, name));
    } catch (err) {
      // a 400 is about this name: pick another; anything else is the game saying no
      if (axios.isAxiosError(err) && err.response?.status === 409) onRefused(errorMessage(err));
      else setProblem(errorMessage(err));
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="jqzz-whoami">
      <h1 className="jqzz-stage-title OEF jqzz-chroma">who are you?</h1>
      <p className="jqzz-play-note">
        {game.status === "LOBBY" ? "pick your name. it only counts in this game." : "the game's on. pick your name to jump in."}
      </p>
      <div className="jqzz-whoami-list">
        {names.map((n) => {
          const closed = (roster.unique && n.taken) || n.yours;
          const tag = n.yours
            ? "that's you"
            : n.taken
              ? roster.unique
                ? n.away
                  ? "here already · away"
                  : "here already"
                : "someone picked this too"
              : null;
          return (
            <button
              key={n.name}
              className="jqzz-whoami-name"
              disabled={closed || !!joining}
              aria-current={n.yours || undefined}
              onClick={() => pick(n.name)}
            >
              <span>{n.name}</span>
              {tag && <span className="jqzz-annot">{tag}</span>}
            </button>
          );
        })}
      </div>
      {joining && <p className="jqzz-play-note">joining as {joining}...</p>}
      {problem && <p className="jqzz-play-note bad">{problem}</p>}
      {allTaken && (
        <p className="jqzz-play-note">
          everyone on the list is here. if one of them is you on a new phone, ask the host to take the old one out.
        </p>
      )}
      <p className="jqzz-play-note">not on the list? ask the host.</p>
      {onCancel && (
        <button className="jqzz-play-btn ghost" onClick={onCancel}>
          keep {mine?.name ?? "my name"}
        </button>
      )}
    </div>
  );
};
