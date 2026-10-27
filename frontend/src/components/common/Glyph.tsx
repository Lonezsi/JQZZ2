import React from "react";

/*
 * One icon family for phases and question types: 16px grid, 1.5px stroke,
 * round caps, currentColor. Drawn here so they match each other exactly.
 */
const PATHS: Record<string, React.ReactNode> = {
  // phases
  WAITING: (
    <>
      <path d="M4.5 2h7M4.5 14h7" />
      <path d="M5.5 2c0 3.2 5 3.6 5 6s-5 2.8-5 6M10.5 2c0 3.2-5 3.6-5 6s5 2.8 5 6" />
      <path d="M6.6 12.4h2.8" />
    </>
  ),
  QUESTION: (
    <>
      <path d="M2.5 4.2A1.7 1.7 0 0 1 4.2 2.5h7.6a1.7 1.7 0 0 1 1.7 1.7v5.6a1.7 1.7 0 0 1-1.7 1.7H7.2L4 14v-2.5h0.2a1.7 1.7 0 0 1-1.7-1.7z" />
      <path d="M6.7 5.4a1.4 1.4 0 1 1 1.9 1.3c-.4.2-.6.5-.6.9v.2" />
      <path d="M8 9.4v.05" />
    </>
  ),
  ANSWER: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="m5.4 8.2 1.8 1.8 3.5-3.7" />
    </>
  ),
  ELABORATION: (
    <>
      <path d="M8 4.2C6.5 3.2 4.5 3 2.5 3.4v8.8c2-.4 4-.2 5.5.8 1.5-1 3.5-1.2 5.5-.8V3.4C11.5 3 9.5 3.2 8 4.2z" />
      <path d="M8 4.2V13" />
    </>
  ),
  RESULT: (
    <>
      <path d="M2 13.5h12" />
      <path d="M3 13.5V9.5h3v4M6 13.5V6h4v7.5M10 13.5v-5h3v5" />
      <path d="M8 2.2l.6 1.2 1.3.2-1 .9.3 1.3L8 5.2l-1.2.6.3-1.3-1-.9 1.3-.2z" />
    </>
  ),
  TEXT: (
    <>
      <path d="M4 2.5h5.5L12 5v8.5H4z" />
      <path d="M9.5 2.5V5H12M6 8h4M6 10.5h3" />
    </>
  ),
  DIVIDER: (
    <>
      <path d="M1.5 8h4M10.5 8h4" />
      <path d="M8 5.5 10.5 8 8 10.5 5.5 8z" />
    </>
  ),
  // two sliders: settings that hold until changed
  SETTING: (
    <>
      <path d="M2.5 5h11M2.5 11h11" />
      <circle cx="5.5" cy="5" r="1.6" fill="var(--glyph-fill, transparent)" />
      <circle cx="10.5" cy="11" r="1.6" fill="var(--glyph-fill, transparent)" />
    </>
  ),
  // places and things in the stash
  QUIZ: (
    <>
      <path d="M3 2.5h7.5L13 5v8.5H3z" />
      <path d="M5.5 6.5h5M5.5 9h5M5.5 11.5h3" />
    </>
  ),
  ITEM_QUESTION: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M6.6 6.3a1.5 1.5 0 1 1 2 1.4c-.4.2-.6.5-.6.9v.4M8 11v.05" />
    </>
  ),
  IMAGE: (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.1" />
      <path d="m3 12 3.5-3.5 2.5 2.5 1.5-1.5 2.5 2.5" />
    </>
  ),
  TYPE: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <path d="M11.25 9v4.5M9 11.25h4.5" />
    </>
  ),
  BROWSE: (
    <>
      <circle cx="7" cy="7" r="4.3" />
      <path d="m10.2 10.2 3.3 3.3" />
    </>
  ),
  HISTORY: (
    <>
      <path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.8M2.5 2.5v2.4h2.4M8 5v3.2l2 1.4" />
    </>
  ),
  STASH: (
    <>
      <path d="M2.5 5.5h11v7.5h-11zM4 5.5 5.2 3h5.6L12 5.5M6.2 8.5h3.6" />
    </>
  ),
  YOU: (
    <>
      <circle cx="8" cy="5.5" r="2.6" />
      <path d="M3 13.5c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" />
    </>
  ),
  PRIVATE: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.3" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
    </>
  ),
  SEMI_PRIVATE: (
    <>
      <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6" />
      <path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6" />
    </>
  ),
  PUBLIC: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M2.2 8h11.6M8 2.2c1.7 1.6 2.5 3.5 2.5 5.8S9.7 12.2 8 13.8C6.3 12.2 5.5 10.3 5.5 8S6.3 3.8 8 2.2z" />
    </>
  ),
  SNIPPETS: (
    <>
      <path d="M2.5 4h11M2.5 8h7M2.5 12h9" />
    </>
  ),
  RESET: (
    <>
      <path d="M3 8a5 5 0 1 0 1.5-3.5M3 2.8v2.7h2.7" />
    </>
  ),
  ADD: (
    <>
      <path d="M8 3v10M3 8h10" />
    </>
  ),
  CLOSE: (
    <>
      <path d="m4 4 8 8M12 4l-8 8" />
    </>
  ),
  TROPHY: (
    <>
      <path d="M5 2.5h6v3.5a3 3 0 0 1-6 0z" />
      <path d="M5 3.5H2.8a2.2 2.2 0 0 0 2.4 2.6M11 3.5h2.2a2.2 2.2 0 0 1-2.4 2.6M8 9v2.5M5.5 13.5h5M6.5 11.5h3" />
    </>
  ),
  TARGET: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <circle cx="8" cy="8" r="3" />
      <circle cx="8" cy="8" r=".6" fill="currentColor" />
    </>
  ),
  STAR: (
    <>
      <path d="m8 2 1.8 3.7 4 .6-2.9 2.8.7 4L8 11.2 4.4 13.1l.7-4L2.2 6.3l4-.6z" />
    </>
  ),
  PEN: (
    <>
      <path d="M10.5 2.8a1.6 1.6 0 0 1 2.3 2.3L5.6 12.3 2.5 13.5l1.2-3.1z" />
      <path d="m9.5 3.8 2.3 2.3" />
    </>
  ),
  FRIENDS: (
    <>
      <circle cx="6" cy="5.5" r="2.3" />
      <path d="M1.8 13c.5-2.3 2.2-3.5 4.2-3.5s3.7 1.2 4.2 3.5" />
      <path d="M10.3 3.4a2.3 2.3 0 0 1 0 4.3M11.8 9.8c1.3.5 2.1 1.6 2.4 3.2" />
    </>
  ),
  FRIEND_ADD: (
    <>
      <circle cx="6.5" cy="5.5" r="2.4" />
      <path d="M2 13.3c.5-2.4 2.3-3.7 4.5-3.7 1.2 0 2.3.4 3.1 1.1" />
      <path d="M12.5 8.5v4.5M10.25 10.75h4.5" />
    </>
  ),
  CHECK: (
    <>
      <path d="m3 8.5 3.2 3.2L13 4.8" />
    </>
  ),
  // question types
  PREWRITTEN_SINGLE: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  PREWRITTEN_MULTIPLE: (
    <>
      <rect x="2.5" y="2.5" width="5" height="5" rx="1.2" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="1.2" />
      <path d="m3.8 5 1 1 1.6-1.8M9.8 11l1 1 1.6-1.8" />
    </>
  ),
  USER_GENERATED: (
    <>
      <path d="M3 13l.9-3.4 7-7a1.4 1.4 0 0 1 2 2l-7 7z" />
      <path d="M9.6 3.9l2 2" />
    </>
  ),
  USER_GENERATED_VOTE: (
    <>
      <rect x="2.5" y="7.5" width="11" height="6" rx="1" />
      <path d="M5.5 7.5V3h5v4.5M6.8 5.3l.9.9 1.6-1.6M5 10.5h6" />
    </>
  ),
  USER_GENERATED_IDENTIFY: (
    <>
      <path d="M1.5 8S3.8 3.8 8 3.8 14.5 8 14.5 8 12.2 12.2 8 12.2 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  TIERLIST: (
    <>
      <path d="M2.5 3.5h11M2.5 8h7.5M2.5 12.5h4" />
    </>
  ),
  KNOCKOUT_BATTLE: (
    <>
      <path d="M2 3h3.5v4H9M2 11h3.5V7M9 7h1.5v2H14M10.5 9v2.5H14" />
    </>
  ),
};

interface GlyphProps {
  name: string;
  size?: number;
  className?: string;
}

export const Glyph: React.FC<GlyphProps> = ({ name, size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {PATHS[name] ?? PATHS.TEXT}
  </svg>
);
