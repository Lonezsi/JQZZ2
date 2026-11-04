import React from "react";
import type { ToolId } from "./brushes";

/* Small drawings of the tools, in the line style of the app's glyphs. */

const paths: Record<ToolId, React.ReactNode> = {
  pencil: (
    <>
      <path d="M4 20l1.2-4.6L16.6 4a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" />
      <path d="M14.5 6.1l3.4 3.4M5.2 15.4l3.4 3.4" />
    </>
  ),
  ink: (
    <>
      <path d="M12 3l4.5 7.5L12 21l-4.5-10.5z" />
      <path d="M12 11.5v3.2" />
      <circle cx="12" cy="10.2" r="1.1" />
    </>
  ),
  marker: (
    <>
      <path d="M7 17l-2 3h5l1-1.6" />
      <path d="M8.5 15.8l9.3-9.3a1.8 1.8 0 0 0-2.5-2.5L6 13.3z" />
      <path d="M6 13.3l2.5 2.5" />
    </>
  ),
  crayon: (
    <>
      <path d="M5 19l2.2-5.6 9.7-9.7 3.4 3.4-9.7 9.7z" />
      <path d="M10.2 10.4l3.4 3.4M12.6 8l3.4 3.4" />
    </>
  ),
  charcoal: (
    <>
      <path d="M6.5 18.5l11-11a2.1 2.1 0 0 0-3-3l-11 11z" />
      <path d="M4 20.5c1.5.2 3-.3 4.2-1.3" strokeDasharray="1 2" />
    </>
  ),
  paint: (
    <>
      <path d="M14 10l6-6.2a1.4 1.4 0 0 1 2 2L15.8 12" />
      <path d="M13.2 10.8l2 2c.6 2.6-1.2 6.2-6.4 6.8-2 .2-4-.4-5.3-1.4 2.2-.5 2.4-2.2 2.7-3.8.6-3 3.6-4.6 7-3.6z" />
    </>
  ),
  watercolor: (
    <>
      <path d="M12 3.5c3.2 4.2 5.2 7.3 5.2 10a5.2 5.2 0 0 1-10.4 0c0-2.7 2-5.8 5.2-10z" />
      <path d="M9.6 14.2a2.6 2.6 0 0 0 2.4 2.6" />
    </>
  ),
  airbrush: (
    <>
      <path d="M9 9h6v11H9z" />
      <path d="M10.5 9V6.5h3V9" />
      <path d="M17 5.5h.01M19 7.5h.01M19 3.5h.01M21 5.5h.01" strokeWidth="2.2" />
    </>
  ),
  smudge: (
    <>
      <path d="M8.5 13V6.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11.5 11V5a1.5 1.5 0 0 1 3 0v6" />
      <path d="M14.5 11.2V7a1.5 1.5 0 0 1 3 0v6.5c0 4-2.6 6.5-6.2 6.5-2.4 0-4-1.2-5.1-3l-1.9-3.4a1.4 1.4 0 0 1 2.4-1.5L8.5 14" />
    </>
  ),
  eraser: (
    <>
      <path d="M9.2 19.5H20" />
      <path d="M4.6 15.2l9-9a2 2 0 0 1 2.8 0l3.4 3.4a2 2 0 0 1 0 2.8L12.7 19.5H8.9z" />
      <path d="M9.6 10.2l6.2 6.2" />
    </>
  ),
  fill: (
    <>
      <path d="M5.5 11.5l6-6 7 7-6 6a2 2 0 0 1-2.8 0l-4.2-4.2a2 2 0 0 1 0-2.8z" />
      <path d="M5.5 11.5h13" />
      <path d="M20.5 15.5s1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 1.5-3 1.5-3z" />
    </>
  ),
  pick: (
    <>
      <path d="M14.5 6.5l3 3" />
      <path d="M16.2 3.8a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L18 10l-4-4z" />
      <path d="M15 9l-8.5 8.5-2.5 2.5-.5-.5 2.5-2.5L14.5 8.5" />
    </>
  ),
};

export const ToolIcon: React.FC<{ tool: ToolId; size?: number }> = ({ tool, size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paths[tool]}
  </svg>
);

const actions = {
  undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />,
  clear: <path d="M5 7h14M10 11v6M14 11v6M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5M9.5 7V4.5h5V7" />,
  mirror: (
    <>
      <path d="M12 3v18" strokeDasharray="2 2.4" />
      <path d="M9 7L4 17h5zM15 7l5 10h-5z" />
    </>
  ),
  /* the page turned over: an arrow each way across a line */
  flip: (
    <>
      <path d="M12 4v16" />
      <path d="M8.5 8.5 4.5 12l4 3.5M15.5 8.5l4 3.5-4 3.5" />
    </>
  ),
  paper: (
    <>
      <path d="M6 3.5h8.5L19 8v12.5H6z" />
      <path d="M14.5 3.5V8H19" />
    </>
  ),
  // sheets stacked
  layers: (
    <>
      <path d="M12 4l8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4M4 16l8 4 8-4" />
    </>
  ),
  add: <path d="M12 5v14M5 12h14" />,
  duplicate: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  // two layers pressed into one
  merge: (
    <>
      <path d="M12 3v8M8.5 7.5 12 11l3.5-3.5" />
      <path d="M4 14l8 4 8-4" />
    </>
  ),
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  hidden: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5c2 0 3.7.7 5.1 1.7M21.5 12S18 18.5 12 18.5c-2 0-3.7-.7-5.1-1.7" />
      <path d="M4 20 20 4" />
    </>
  ),
  // a padlock: paint only where there's paint
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
};

export const ActionIcon: React.FC<{ name: keyof typeof actions; size?: number }> = ({ name, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {actions[name]}
  </svg>
);
