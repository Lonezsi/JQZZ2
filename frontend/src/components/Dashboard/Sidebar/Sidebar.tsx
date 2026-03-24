import React from "react";
import type { User, Quiz, Snippet } from "../../../types";
import { Identity as IdentityComponent } from "./Identity";
import { QuizList } from "./QuizList";
import { SnippetList } from "./SnippetList";
import { FooterShortcuts } from "./FooterShortcuts";

interface SidebarProps {
  identity: User | null;
  onIdentityClick: () => void;
  quizzes: Quiz[];
  activeQuizId: number | null;
  onSelectQuiz: (id: number) => void;
  onNewQuiz: () => void;
  snippets: Snippet[];
  draggingSnippet: string | null;
  onSnippetDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onSnippetDragEnd: () => void;
  onSnippetClick: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  identity,
  onIdentityClick,
  quizzes,
  activeQuizId,
  onSelectQuiz,
  onNewQuiz,
  snippets,
  draggingSnippet,
  onSnippetDragStart,
  onSnippetDragEnd,
  onSnippetClick,
}) => {
  return (
    <aside className="jqzz-sidebar">
      <div className="jqzz-logo">
        <img
          src="/icon-white.png"
          alt="Logo"
          className="jqzz-logo-img"
          style={{
            width: "64px",
            height: "64px",
            marginRight: "8px",
          }}
        />
        <span className="jqzz-logo-badge">JQ</span>
        <span className="jqzz-logo-name">ZZ</span>
      </div>

      <div className="jqzz-sid-section jqzz-sid-separator">
        <div className="jqzz-sid-label">Navigaton</div>
        <button className="jqzz-sid-btn">Home</button>
      </div>

      <div className="jqzz-sid-section">
        <div className="jqzz-sid-label">Account</div>
        <IdentityComponent identity={identity} onClick={onIdentityClick} />
      </div>

      <div className="jqzz-sid-section">
        <div className="jqzz-sid-label">Quick Actions</div>
        <button className="jqzz-sid-btn accent" onClick={onNewQuiz}>
          + New Quiz <span className="jqzz-kbd">^N</span>
        </button>
        <button
          className="jqzz-sid-btn"
          onClick={() => alert("Import .txt flow")}
        >
          ↑ Import .txt <span className="jqzz-kbd">^I</span>
        </button>
        <button className="jqzz-sid-btn" onClick={() => alert("Join lobby")}>
          ▶ Join Lobby
        </button>
      </div>

      <QuizList
        quizzes={quizzes}
        activeQuizId={activeQuizId}
        onSelectQuiz={onSelectQuiz}
      />

      <SnippetList
        snippets={snippets}
        draggingSnippet={draggingSnippet}
        onSnippetDragStart={onSnippetDragStart}
        onSnippetDragEnd={onSnippetDragEnd}
        onSnippetClick={onSnippetClick}
      />

      <FooterShortcuts />
    </aside>
  );
};
