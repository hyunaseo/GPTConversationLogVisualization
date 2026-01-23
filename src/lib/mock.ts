import type { ChatThread } from "../types";

export const mockThreads: ChatThread[] = [
  {
    id: "t1",
    title: "Infographics Request",
    startTime: Date.parse("2026-01-22T15:00:00+09:00"),
    endTime: Date.parse("2026-01-22T15:30:00+09:00"),
    hasImages: true,
    messageCount: 6,
  },
  {
    id: "t2",
    title: "Code Snippet Debugging",
    startTime: Date.parse("2026-01-07T15:00:00+09:00"),
    endTime: Date.parse("2026-01-07T17:00:00+09:00"),
    hasImages: false,
    messageCount: 14,
  },
  {
    id: "t3",
    title: "Lecture Photo Request",
    startTime: Date.parse("2026-01-19T16:00:00+09:00"),
    endTime: Date.parse("2026-01-19T16:20:00+09:00"),
    hasImages: true,
    messageCount: 4,
  },
];
