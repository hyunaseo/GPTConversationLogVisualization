import type { ChatProvider, ProviderType } from "../../types";
import { ChatGPTProvider } from "./chatgpt";
import { GeminiProvider } from "./gemini";

export function getProvider(type: ProviderType): ChatProvider {
  switch (type) {
    case "chatgpt":
      return new ChatGPTProvider();
    case "gemini":
      return new GeminiProvider();
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
