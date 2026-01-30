import type { ProviderType } from "../../types";

export function detectProvider(paths: string[]): ProviderType {
  // ChatGPT: conversations.json in root
  const hasChatGPTJson = paths.some((p) =>
    p.toLowerCase().endsWith("conversations.json")
  );
  if (hasChatGPTJson) {
    return "chatgpt";
  }

  // Gemini: Takeout/My Activity/Gemini Apps/MyActivity.html
  const geminiPattern = /Takeout\/My Activity\/Gemini Apps\/MyActivity\.html/i;
  const hasGeminiHtml = paths.some((p) => geminiPattern.test(p));
  if (hasGeminiHtml) {
    return "gemini";
  }

  return "unknown";
}
