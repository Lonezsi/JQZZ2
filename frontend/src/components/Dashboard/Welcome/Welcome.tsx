import React from "react";

interface WelcomeProps {
  onCreate?: () => void;
  onOpen?: () => void;
}

export const Welcome: React.FC<WelcomeProps> = () => {
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

          <hr />
          <p className="jqzz-welcome-subtitle">
            All this bc i fuck kahoot and all the for profit clones of it. Fuck
            corporate slop.
          </p>
        </div>
      </header>

      <section className="jqzz-welcome-features">
        <div className="jqzz-feature">
          <h3>Visual</h3>
          <p>
            Drag shit around, duplicate it, delete it. If you can't figure it
            out in 5 seconds, I failed. No tutorials needed.
          </p>
        </div>
        <div className="jqzz-feature">
          <h3>AI-Slopify</h3>
          <h4>/coming soon/</h4>
          <p>
            You can type a prompt and it'll generate something. Probably
            garbage. But maybe garbage you can fix.
          </p>
        </div>
        <div className="jqzz-feature">
          <h3>Sign in philosophy</h3>
          <p>
            No accounts. No bullshit. No motherfucking please give us 5 pages of
            data to click a button. God I hate corporate enshittification
          </p>
        </div>
        <div className="jqzz-feature">
          <h3>Dynamic Questions</h3>
          <p>
            Oh this is fun! i made it modular and it uses a script pseudolang
            for poweruser fuckery
          </p>
        </div>
      </section>

      <section className="jqzz-welcome-showcase">
        <div className="jqzz-showcase-card">
          <h2>Visual Mode</h2>
          <p>
            Timeline of actions. Click, drag, rearrange. If you need an
            explanation, maybe stick to PowerPoint.
          </p>
        </div>

        <div className="jqzz-showcase-card">
          <h2>Text Mode</h2>
          <p>
            Prefer scripting? Write your quiz like code. Fast editing, full
            control.
          </p>
        </div>
      </section>

      <section className="jqzz-welcome-footer">
        <p>stop reading bro im not shakespear.</p>
      </section>
    </div>
  );
};
