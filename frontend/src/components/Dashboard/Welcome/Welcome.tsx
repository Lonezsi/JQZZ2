import React from "react";
import { useQuiz } from "../../../contexts/QuizContext";
import { useWebSocket } from "../../../contexts/WebSocketContext";

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
    body: "No accounts. No bullshit. No motherfucking please give us 5 pages of data to click a button. God I hate corporate enshittification",
  },
  {
    tag: "play",
    title: "Run it live",
    body: "Hit Start, put the big screen up, everyone joins on their phone with the code. Votes, guesses, tier lists, knockout battles.",
  },
];

export const Welcome: React.FC<WelcomeProps> = ({ onCreate, onImport }) => {
  const { quizzes } = useQuiz();
  const { connected } = useWebSocket();
  const totalActions = quizzes.reduce((sum, q) => sum + q.actions.length, 0);

  return (
    <div className="jqzz-welcome-root jqzz-view-in">
      <div className="jqzz-welcome-notes" aria-hidden="true">
        <span className="jqzz-annot w-tl">
          jqzz
          <br />
          {String(quizzes.length).padStart(2, "0")} quizzes · {totalActions} actions
          <br />
          server {connected ? "live" : "down"}
        </span>
        <span className="jqzz-annot w-vert-l">
          joe quizz with all the juestions for your janswers
        </span>
      </div>

      <header className="jqzz-welcome-hero">
        <div className="jqzz-welcome-burst" aria-hidden="true">
          <div className="jqzz-halftone jqzz-welcome-dots" />
          <span className="jqzz-welcome-axis" />
          <span className="jqzz-welcome-orbit" />
        </div>
        <div className="jqzz-welcome-logo" role="img" aria-label="JQZZ" />
        <h1 className="visually-hidden">JQZZ</h1>
        <p className="jqzz-welcome-subtitle">all this just bc fuck kahoot and all corporate slop</p>
        <div className="jqzz-welcome-actions">
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
        <p className="jqzz-annot jqzz-welcome-hint">
          {quizzes.length > 0 ? "or open one on the left. " : ""}ctrl k for everything else.
        </p>
      </header>

      <section className="jqzz-welcome-features" aria-label="What this is">
        {FEATURES.map((f) => (
          <article key={f.title} className="jqzz-feature">
            <span className="jqzz-annot">{f.tag}</span>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </article>
        ))}
      </section>

      <footer className="jqzz-welcome-footer">stop reading bro im not shakespear.</footer>
    </div>
  );
};
