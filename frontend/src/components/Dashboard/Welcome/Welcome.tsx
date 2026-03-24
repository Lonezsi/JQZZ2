import React from "react";

interface WelcomeProps {
  onCreate?: () => void;
  onOpen?: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onCreate, onOpen }) => {
  return (
    <div className="jqzz-welcome-root">
      <div className="jqzz-welcome-bg" />

      <header className="jqzz-welcome-hero">
        <div className="jqzz-welcome-hero-content">
          <div className="jqzz-welcome-logo">
            <img
              src="logo.png"
              alt="logo"
              style={{
                width: "256px",
                height: "256px",
                filter: "invert(100%)",
                opacity: 1,
                WebkitMask: "url(/icon-white.png) no-repeat center / contain",
              }}
            />
          </div>

          <h1 className="jqzz-welcome-title OEF">JQZZ</h1>

          <p className="jqzz-welcome-subtitle">
            Build interactive quiz experiences with drag-and-drop blocks,
            real-time multiplayer, and AI-powered creativity. From memes to mind
            games — everything belongs here.
          </p>

          <div className="jqzz-welcome-actions">
            <button
              className="jqzz-btn primary"
              onClick={onCreate || (() => alert("Create Quiz"))}
            >
              + Create New Quiz
            </button>

            <button
              className="jqzz-btn secondary"
              onClick={onOpen || (() => alert("Open Quiz"))}
            >
              Open Existing
            </button>
          </div>
        </div>
      </header>

      <section className="jqzz-welcome-features">
        <div className="jqzz-feature">
          <h3>⚡ Visual Builder</h3>
          <p>
            Drag, drop, and rearrange actions like building blocks. Design your
            quiz flow exactly how you imagine it — fast, flexible, and fun.
          </p>
        </div>

        <div className="jqzz-feature">
          <h3>🧠 AI-Powered Ideas</h3>
          <p>
            Stuck? Let AI generate chaotic, funny, or genius quiz concepts
            instantly. Turn a single prompt into a full experience.
          </p>
        </div>

        <div className="jqzz-feature">
          <h3>🎮 Multiplayer Ready</h3>
          <p>
            Real-time lobbies, live scoring, and interactive phases. Perfect for
            parties, classrooms, or late-night chaos.
          </p>
        </div>

        <div className="jqzz-feature">
          <h3>🧩 Flexible Question Types</h3>
          <p>
            From classic multiple choice to tierlists, battles, and
            user-generated madness — mix mechanics however you want.
          </p>
        </div>
      </section>

      <section className="jqzz-welcome-showcase">
        <div className="jqzz-showcase-card">
          <h2>Visual Mode</h2>
          <p>
            See your quiz as a timeline of actions. Rearrange, duplicate, and
            tweak everything with intuitive controls.
          </p>
        </div>

        <div className="jqzz-showcase-card">
          <h2>Text Mode</h2>
          <p>
            Prefer scripting? Write your quiz like code. Fast editing, full
            control, and instant parsing.
          </p>
        </div>

        <div className="jqzz-showcase-card">
          <h2>Hybrid Workflow</h2>
          <p>
            Switch between visual and text modes anytime. Build your own
            workflow — structured or chaotic.
          </p>
        </div>
      </section>

      <section className="jqzz-welcome-footer">
        <p>Start creating. Break rules. Surprise your players.</p>
      </section>
    </div>
  );
};
