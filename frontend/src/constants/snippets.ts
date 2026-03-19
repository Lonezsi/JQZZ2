import type { Snippet } from "../types";

export const SNIPPETS: Snippet[] = [
  {
    id: "s-mc",
    name: "Full MC question",
    color: "#00e5c8",
    steps: [
      { phase: "WAITING", time: 8, preview: "Pre-question buffer" },
      { phase: "QUESTION", time: 30, preview: "Multiple-choice question" },
      { phase: "ANSWER", time: 12, preview: "Answer reveal" },
      { phase: "RESULT", time: 10, preview: "Leaderboard update" },
    ],
  },
  {
    id: "s-tf",
    name: "True / False",
    color: "#a3e635",
    steps: [
      { phase: "WAITING", time: 6, preview: "Pre-question buffer" },
      { phase: "QUESTION", time: 20, preview: "True or False?" },
      { phase: "ANSWER", time: 8, preview: "Answer reveal" },
    ],
  },
  {
    id: "s-elab",
    name: "Question + explain",
    color: "#fbbf24",
    steps: [
      { phase: "WAITING", time: 8, preview: "Pre-question buffer" },
      { phase: "QUESTION", time: 30, preview: "Question phase" },
      { phase: "ANSWER", time: 10, preview: "Answer locked" },
      { phase: "ELABORATION", time: 20, preview: "Deep-dive explanation" },
      { phase: "RESULT", time: 10, preview: "Leaderboard update" },
    ],
  },
  {
    id: "s-ugv",
    name: "User-gen + vote",
    color: "#f472b6",
    steps: [
      { phase: "WAITING", time: 6, preview: "Pre-question buffer" },
      { phase: "QUESTION", time: 40, preview: "Players submit answers" },
      { phase: "ANSWER", time: 20, preview: "Vote on best answer" },
      { phase: "RESULT", time: 12, preview: "Winner revealed" },
    ],
  },
  {
    id: "s-tier",
    name: "Tier list round",
    color: "#a78bfa",
    steps: [
      { phase: "WAITING", time: 6, preview: "Pre-question buffer" },
      { phase: "QUESTION", time: 60, preview: "Drag items into tiers" },
      { phase: "RESULT", time: 15, preview: "Group tier comparison" },
    ],
  },
  {
    id: "s-bolt",
    name: "Lightning round",
    color: "#f87171",
    steps: [
      { phase: "WAITING", time: 3, preview: "Quick buffer" },
      { phase: "QUESTION", time: 10, preview: "Fast question" },
      { phase: "ANSWER", time: 5, preview: "Answer reveal" },
    ],
  },
];
