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
