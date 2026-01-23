import type { ChatThread } from "../types";

function safeTitleFromPath(path: string) {
  // ".../some-id/chat.html" -> "some-id"
  const parts = path.split("/").filter(Boolean);
  const parent = parts.length >= 2 ? parts[parts.length - 2] : path;
  return parent;
}

export function parseChatHtmlToThread(html: string, chatHtmlPath: string): ChatThread {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const imgs = Array.from(doc.querySelectorAll("img"));
  const hasImages = imgs.length > 0;

  // messageCount도 일단은 대충이라도 잡기 (나중에 개선)
  // 흔히 export html은 메시지 블록이 반복되는데 구조가 버전별로 달라서,
  // MVP에서는 문단 수로 대충 잡아두자.
  const messageCount = doc.querySelectorAll("p").length;

  return {
    id: chatHtmlPath,
    title: safeTitleFromPath(chatHtmlPath),
    hasImages,
    messageCount: Math.max(1, messageCount),
    // start/endTime은 아직 미구현 (나중에 html에서 timestamp 파싱)
  };
}
