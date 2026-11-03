import React, { useEffect, useRef, useState } from "react";
import { useQuiz } from "../../../contexts/QuizContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useWebSocket } from "../../../contexts/WebSocketContext";
import { usePeople } from "../../../hooks/usePeople";
import { useFriends } from "../../../hooks/useFriends";
import { playService } from "../../../services/playService";
import { GameModes } from "./GameModes";
import { StarFlare } from "./StarFlare";

interface WelcomeProps {
  onCreate?: () => void;
  onImport?: () => void;
}

const FEATURES: { tag: string; title: string; body: string }[] = [
  {
    tag: "visual mode",
    title: "Visual",
    body: "Drag shit around, duplicate it, delete it. If you can't figure it out in 5 seconds, I failed. No tutorials needed.",
  },
  {
    tag: "text mode",
    title: "Dynamic Questions",
    body: "Oh this is fun! i made it modular and it uses a script pseudolang for poweruser fuckery",
  },
  {
    tag: "accounts",
    title: "Sign in philosophy",
    body: "No accounts needed. Guest account is made automatically. No bullshit. No motherfucking please give us 5 pages of data to click a button. God I hate corporate enshittification",
  },
  {
    tag: "play",
    title: "Run it live",
    body: "Hit Start, put the big screen up, everyone joins on their phone with the code. Votes, guesses, tier lists, knockout battles.",
  },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** games under way, checked once and then every half minute */
function useLiveGames() {
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => {
    let gone = false;
    const check = () =>
      playService
        .live()
        .then((n) => !gone && setLive(n))
        .catch(() => {});
    check();
    const t = window.setInterval(check, 30_000);
    return () => {
      gone = true;
      window.clearInterval(t);
    };
  }, []);
  return live;
}

/**
 * The front page is a poster: the first screen is the whole of it, laid out
 * like a printed one (numbers in the corners, notes in the margins, one star
 * where the lines cross). Everything in the margins is real: your quizzes,
 * who's online, what's being played. Game modes and the notes come after it.
 */
export const Welcome: React.FC<WelcomeProps> = ({ onCreate, onImport }) => {
  const { quizzes } = useQuiz();
  const { user } = useAuth();
  const { connected } = useWebSocket();
  const { online } = usePeople();
  const { friends } = useFriends();
  const live = useLiveGames();
  const mine = quizzes.filter((q) => q.authorId === user?.id);
  const phases = mine.reduce((sum, q) => sum + q.actions.length, 0);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

  // the poster is exactly as tall as what you can see of the page
  const rootRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const scroller = rootRef.current?.parentElement;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setHeight(scroller.clientHeight));
    ro.observe(scroller);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="jqzz-welcome-root">
      <section
        className="jqzz-poster"
        style={height ? ({ "--poster-h": `${height}px` } as React.CSSProperties) : undefined}
        aria-label="jqzz"
      >
        {/* image 3's grid; its lit planet is in the background (Atmosphere) */}
        <div className="jqzz-poster-grid" aria-hidden="true">
          <span className="gv g1" />
          <span className="gv g2" />
          <span className="gv g3" />
          <span className="gh h1" />
          <span className="gh h2" />
          <span className="corner c1" />
          <span className="corner c2" />
        </div>

        {/* the corners and margins, image 1's */}
        <span className="p-num p-tl from-l" title="quizzes you made">
          {pad(mine.length)}
        </span>
        <span className="p-title from-top">{today}</span>
        <span className="p-num p-tr from-r" title="your friends">
          {pad(friends.length)}
        </span>
        <span className="p-dots from-top" aria-hidden="true" />

        <span className="jqzz-annot p-coords from-l">
          ( {pad(mine.length)} quizzes , {phases} phases )
          <br />↓<br />( {live ?? "··"} live , {online.length} online )
        </span>
        <span className="p-plus p-plus-l from-l" aria-hidden="true" />
        <span className="p-lines from-l" aria-hidden="true" />
        <span className="jqzz-annot p-vert-l from-l">joe quizz with all the juestions for your janswers</span>

        <span className="jqzz-annot p-vert-r from-r">
          you : @{user?.handle ?? user?.name ?? "guest"} · server {connected ? "live" : "down"}
        </span>
        <span className="p-plus p-plus-r from-r" aria-hidden="true" />
        <span className="p-dotline p-dl-1 from-r" aria-hidden="true" />
        <span className="p-dotline p-dl-2 from-r" aria-hidden="true" />

        {/* the axis the star flies up, and where it stops */}
        <span className="p-axis" aria-hidden="true" />
        <span className="p-arc p-arc-1" aria-hidden="true" />
        <span className="p-arc p-arc-2" aria-hidden="true" />
        <span className="p-star" aria-hidden="true">
          <span className="p-star-trail" />
          <StarFlare className="p-star-core" />
        </span>

        {/* image 3's lockup */}
        <h1 className="p-lockup">
          <span className="p-word-a OEF from-l">joe</span>
          <span className="p-spark p-spark-a" aria-hidden="true" />
          <span className="p-word-b from-l">quizz</span>
          <span className="p-spark p-spark-b" aria-hidden="true" />
        </h1>
        <p className="p-tagline from-r">
          <span>all this just bc fuck kahoot</span>
          <span>
            and all corporate <em>slop</em>
          </span>
        </p>
        <div className="p-actions from-r">
          {onCreate && (
            <button className="jqzz-toolbar-btn run" onClick={onCreate}>
              New quiz
            </button>
          )}
          {onImport && (
            <button className="jqzz-toolbar-btn" onClick={onImport}>
              Import .txt
            </button>
          )}
          <a className="jqzz-toolbar-btn" href="#/join">
            Join a game
          </a>
        </div>

        <span className="jqzz-annot p-bl from-l">
          game modes
          <br />
          and how it works ↓
        </span>
        <span className="jqzz-annot p-br from-r">
          ctrl k for everything
          <br />
          <span className="p-br-dots" aria-hidden="true">· · · ·</span>
        </span>
      </section>

      <section className="jqzz-welcome-features" aria-label="What this is">
        {FEATURES.map((f) => (
          <article key={f.title} className="jqzz-feature">
            <span className="jqzz-annot">{f.tag}</span>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </article>
        ))}
      </section>

      <GameModes />

      <footer className="jqzz-welcome-footer">
        stop reading bro im not shakespeare. <a href="/foyer/privacy">privacy</a>
      </footer>
    </div>
  );
};
