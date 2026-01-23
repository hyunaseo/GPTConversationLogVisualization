import type { ChatThread } from "../types";

export const mockThreads: ChatThread[] = [
  {
    id: "t1",
    title: "",
    startTime: Date.parse("0000-00-00T15:00:00+00:00"),
    endTime: Date.parse("2026-01-22T15:30:00+09:00"),
    hasImages: true,
    messageCount: 0,
  }
];
